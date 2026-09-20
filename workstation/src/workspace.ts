import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { randomBytes } from "node:crypto";

export class TaskWorkspace {
  readonly sourcesDir: string;
  readonly artifactsDir: string;

  constructor(readonly root: string) {
    this.sourcesDir = join(root, "sources");
    this.artifactsDir = join(root, "artifacts");
    mkdirSync(this.sourcesDir, { recursive: true });
    mkdirSync(this.artifactsDir, { recursive: true });
  }

  resolve(relativePath: string): string {
    const root = resolve(this.root);
    const abs = resolve(root, relativePath);
    const inside = !relative(root, abs).startsWith("..") && !isAbsolute(relative(root, abs));
    if (!inside) {
      throw new Error("Path escapes the task workspace.");
    }
    return abs;
  }

  readBytes(relativePath: string): Buffer {
    const abs = this.resolve(relativePath);
    if (existsSync(abs)) {
      const real = realpathSync(abs);
      const root = realpathSync(this.root);
      const escaped = relative(root, real).startsWith("..") || isAbsolute(relative(root, real));
      if (escaped) {
        throw new Error("Path escapes the task workspace.");
      }
    }
    return readFileSync(abs);
  }

  writeBytes(relativePath: string, data: Buffer | Uint8Array | string): void {
    const normalized = relativePath.replaceAll("\\", "/");
    if (normalized.startsWith("sources/") || normalized.startsWith("originals/")) {
      throw new Error("Refusing to modify immutable source originals.");
    }
    const abs = this.resolve(normalized);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, data);
  }

  exists(relativePath: string): boolean {
    return existsSync(this.resolve(relativePath));
  }

  /** Scratch space inside the task environment — not on the host tmp root. */
  scratchDir(prefix: string): string {
    const dir = join(this.root, ".scratch", `${prefix}-${randomBytes(4).toString("hex")}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  listFiles(): Array<{ path: string; bytes: number }> {
    const collected: Array<{ path: string; bytes: number }> = [];
    const walk = (dir: string, prefix: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir)) {
        const abs = join(dir, entry);
        const rel = prefix ? `${prefix}/${entry}` : entry;
        const stat = statSync(abs);
        if (stat.isDirectory()) walk(abs, rel);
        else collected.push({ path: rel, bytes: stat.size });
      }
    };
    walk(this.sourcesDir, "sources");
    walk(this.artifactsDir, "artifacts");
    return collected;
  }
}
