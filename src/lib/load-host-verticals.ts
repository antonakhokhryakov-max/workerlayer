import { resolve } from "node:path";
import { register as registerClaims } from "../../packages/vertical-claims/src/index";
import { register as registerEchoClerk } from "../../packages/vertical-echo/src/index";
import { register as registerKnowledge } from "../../packages/vertical-knowledge/src/index";
import { register as registerStaff } from "../../packages/vertical-staff/src/index";
import { loadVerticals, readVerticalsConfig } from "@aether/runtime";

/**
 * Assignment-desk loaders. Next cannot `import(variable)` a TypeScript package
 * through the bundler, so first-party paths have a static map — not the kernel,
 * not builtins.ts. Echo is the OEM template (docs/OEM.md). Harbor / Claims /
 * Staff are first-party dogfood on the same map.
 *
 * A stranger package listed only in aether.verticals.json is a leftover: the
 * desk retries config-only load via loadVerticals (tsx). CLI and tests use
 * loadVerticals() directly and do not need this file.
 */
const HOST_LOADERS: Record<string, () => void> = {
  "./packages/vertical-echo": () => registerEchoClerk(),
  "./packages/vertical-knowledge": () => registerKnowledge(),
  "./packages/vertical-claims": () => registerClaims(),
  "./packages/vertical-staff": () => registerStaff(),
};

function loaderFor(spec: string, root: string): (() => void) | undefined {
  if (HOST_LOADERS[spec]) return HOST_LOADERS[spec];
  const abs = resolve(root, spec);
  for (const [key, load] of Object.entries(HOST_LOADERS)) {
    if (resolve(root, key) === abs) return load;
  }
  return undefined;
}

export async function loadHostVerticals(root = process.cwd()): Promise<void> {
  const { verticals } = readVerticalsConfig(root);
  const leftover: string[] = [];
  for (const spec of verticals) {
    const load = loaderFor(spec, root);
    if (load) load();
    else leftover.push(spec);
  }
  if (leftover.length > 0) {
    try {
      await loadVerticals({ paths: leftover, root });
    } catch (error) {
      const hint = leftover
        .map(
          (spec) =>
            `Config-only load failed for '${spec}'. CLI uses aether.verticals.json. Desk leftover: Next cannot import(variable) TypeScript through the bundler; WorkerLayer retries with tsx. If that failed, add a compiled .js main or one static import in src/lib/load-host-verticals.ts. Do not edit runtime/src/builtins.ts. See docs/OEM.md.`,
        )
        .join(" ");
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${hint} ${detail}`);
    }
  }
}
