import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registeredWorkerKinds } from "./registry";

export const VERTICALS_CONFIG_NAME = "aether.verticals.json";

export interface VerticalsConfig {
  verticals: string[];
}

export interface LoadVerticalsOptions {
  /** Explicit specifiers. When set, the config file is not read. */
  paths?: string[];
  /** Directory to resolve relative paths and the default config file. */
  root?: string;
  /** Override config file path. */
  configFile?: string;
}

const loadedEntries = new Map<string, { register?: () => unknown | Promise<unknown> }>();

export function readVerticalsConfig(root = process.cwd(), configFile?: string): VerticalsConfig {
  const fromEnv = process.env.AETHER_VERTICALS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (fromEnv && fromEnv.length > 0) return { verticals: fromEnv };

  const file =
    configFile ??
    process.env.AETHER_VERTICALS_FILE ??
    join(root, VERTICALS_CONFIG_NAME);
  if (!existsSync(file)) return { verticals: [] };
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { verticals?: unknown };
  if (!Array.isArray(parsed.verticals) || parsed.verticals.some((item) => typeof item !== "string")) {
    throw new Error(`${file} must contain { "verticals": ["path-or-package"] }.`);
  }
  return { verticals: parsed.verticals };
}

/**
 * Resolve a config specifier to a file we can import.
 * Directory + package.json uses main / exports["."]. Bare specifiers stay as-is.
 */
export function resolveVerticalEntry(spec: string, root = process.cwd()): string {
  const trimmed = spec.trim();
  if (!trimmed) throw new Error("Vertical specifier is empty.");
  const abs = isAbsolute(trimmed) ? trimmed : resolve(root, trimmed);
  if (existsSync(abs) && statSync(abs).isFile()) return abs;
  const pkgJson = join(abs, "package.json");
  if (existsSync(pkgJson) && statSync(abs).isDirectory()) {
    const pkg = JSON.parse(readFileSync(pkgJson, "utf8")) as {
      main?: string;
      exports?: unknown;
    };
    const entry = entryFromPackage(pkg);
    const resolved = resolve(abs, entry);
    if (!existsSync(resolved)) {
      throw new Error(`Vertical package '${trimmed}' has no file at ${entry}.`);
    }
    return resolved;
  }
  if (trimmed.startsWith(".") || isAbsolute(trimmed)) {
    throw new Error(`Vertical '${trimmed}' was not found at ${abs}.`);
  }
  return trimmed;
}

function entryFromPackage(pkg: { main?: string; exports?: unknown }): string {
  const exportsField = pkg.exports;
  if (typeof exportsField === "string") return exportsField;
  if (exportsField && typeof exportsField === "object") {
    const dot = (exportsField as Record<string, unknown>)["."];
    if (typeof dot === "string") return dot;
    if (dot && typeof dot === "object") {
      const rec = dot as Record<string, unknown>;
      if (typeof rec.import === "string") return rec.import;
      if (typeof rec.default === "string") return rec.default;
    }
  }
  return pkg.main ?? "src/index.ts";
}

/**
 * Import a vertical entry. CLI / tests use native `import()`.
 * Next cannot `import(variable)` TypeScript through the bundler, so leftovers
 * retry with a Node-native import (bundler escape) and tsx. Config-only load
 * is the OEM path; the desk static map is a bundler shortcut, not builtins.ts.
 */
export async function importVerticalModule(entry: string): Promise<unknown> {
  const href =
    entry.includes("/") || entry.endsWith(".ts") || entry.endsWith(".js")
      ? pathToFileURL(entry).href
      : entry;
  try {
    return await import(href);
  } catch (nativeError) {
    try {
      return await importBare(href);
    } catch {
      await hookTsx();
      try {
        return await importBare(href);
      } catch {
        try {
          const api = (await importBare("tsx/esm/api")) as {
            tsImport: (path: string, parent: string) => Promise<unknown>;
          };
          return await api.tsImport(entry, pathToFileURL(entry).href);
        } catch {
          throw nativeError;
        }
      }
    }
  }
}

let tsxHooked = false;

async function hookTsx(): Promise<void> {
  if (tsxHooked) return;
  try {
    const { register } = (await importBare("node:module")) as typeof import("node:module");
    register("tsx/esm", pathToFileURL("./"));
    tsxHooked = true;
  } catch {
    tsxHooked = true;
  }
}

/** Bypass bundler analysis of `import(variable)` so Next can load a leftover .ts file. */
function importBare(specifier: string): Promise<unknown> {
  const load = new Function("s", "return import(s)") as (s: string) => Promise<unknown>;
  return load(specifier);
}

/**
 * Load vertical packages so they can call registerWorker.
 * Not a compiler. Not an API expansion. Kernel is not edited.
 */
export async function loadVerticals(
  options: LoadVerticalsOptions = {},
): Promise<{ entries: string[]; kinds: string[] }> {
  const root = options.root ?? process.cwd();
  const specs =
    options.paths ?? readVerticalsConfig(root, options.configFile).verticals;
  const entries: string[] = [];
  for (const spec of specs) {
    const entry = resolveVerticalEntry(spec, root);
    entries.push(entry);
    let mod = loadedEntries.get(entry);
    if (!mod) {
      const imported = (await importVerticalModule(entry)) as {
        register?: () => unknown | Promise<unknown>;
      };
      if (typeof imported.register !== "function") {
        throw new Error(
          `Vertical '${spec}' must export function register() that calls registerWorker.`,
        );
      }
      mod = imported;
      loadedEntries.set(entry, mod);
    }
    await mod.register?.();
  }
  return { entries, kinds: registeredWorkerKinds() };
}
