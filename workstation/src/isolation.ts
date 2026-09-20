import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { id } from "@aether/contracts";
import type { ExecutionProviderKind, TaskIsolationRecord } from "@aether/contracts";
import { TaskWorkspace } from "./workspace";

export type CommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; maxBuffer?: number; timeout?: number },
) => SpawnSyncReturns<string>;

export interface IsolationProbe {
  path: string;
  readable: boolean;
  error?: string;
}

export interface DestroyResult {
  destroyed: true;
  outputsPreserved: true;
  rootGone: boolean;
}

export interface TaskEnvironment {
  readonly id: string;
  readonly taskId: string;
  readonly kind: ExecutionProviderKind;
  readonly root: string;
  readonly durableRoot: string;
  readonly status: "ready" | "destroyed";
  workspace(): TaskWorkspace;
  probeInside(path: string): IsolationProbe;
  spawn: CommandRunner;
  syncOut(): void;
  destroy(): DestroyResult;
  record(): TaskIsolationRecord;
}

/**
 * Replaceable compute HOW. Auto-default Docker when the daemon is healthy,
 * else unshare-mount, else process-filesystem. Sticky per Task. Customers
 * do not choose docker vs unshare, and they do not choose a substrate.
 */
export interface ExecutionProvider {
  readonly kind: ExecutionProviderKind;
  create(spec: { taskId: string; durableRoot: string }): TaskEnvironment;
}

export interface ComputeHealth {
  dockerHealthy: boolean;
  unshareMount: boolean;
}

export interface SelectComputeOptions {
  /** Replay the kind this Task already used. Not a customer preference. */
  sticky?: ExecutionProviderKind;
  /** Test / probe override. Live process uses detectDockerHealthy + detectUnshareMount. */
  health?: ComputeHealth;
}

export type ComputeProvider = ExecutionProvider;

const ENTER_SCRIPT = `#!/bin/bash
set -euo pipefail
ROOTFS="\${AETHER_ROOTFS:?}"
WORKSPACE="\${AETHER_WORKSPACE:?}"
CWD="\${AETHER_CWD:-/task}"

bind() {
  mkdir -p "\$2"
  mount --bind "\$1" "\$2"
}

bind /usr "\$ROOTFS/usr"
bind /bin "\$ROOTFS/bin"
if [ -d /lib ]; then bind /lib "\$ROOTFS/lib"; fi
if [ -d /lib64 ]; then bind /lib64 "\$ROOTFS/lib64"; fi
if [ -d /etc/alternatives ]; then bind /etc/alternatives "\$ROOTFS/etc/alternatives"; fi
bind "\$WORKSPACE" "\$ROOTFS/task"
mkdir -p "\$ROOTFS/tmp"
mount -t tmpfs -o size=128m,mode=1777 tmpfs "\$ROOTFS/tmp"

export PATH=/usr/sbin:/usr/bin:/bin
export HOME=/tmp
export LANG="\${LANG:-C}"
export LC_ALL="\${LC_ALL:-C}"

CHROOT=/usr/sbin/chroot
if [ ! -x "\$CHROOT" ]; then CHROOT=/usr/bin/chroot; fi
exec "\$CHROOT" "\$ROOTFS" /bin/bash -c 'cd "$1" && shift && exec "$@"' bash "\$CWD" "\$@"
`;

function copyTree(from: string, to: string): void {
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
}

function syncWorkspaceOut(workspaceRoot: string, durableRoot: string): void {
  copyTree(join(workspaceRoot, "artifacts"), join(durableRoot, "artifacts"));
  const findings = join(workspaceRoot, "findings.json");
  if (existsSync(findings)) {
    copyTree(findings, join(durableRoot, "findings.json"));
  }
}

function seedWorkspace(durableRoot: string, workspaceRoot: string): void {
  mkdirSync(join(workspaceRoot, "sources"), { recursive: true });
  mkdirSync(join(workspaceRoot, "artifacts"), { recursive: true });
  copyTree(join(durableRoot, "sources"), join(workspaceRoot, "sources"));
  copyTree(join(durableRoot, "artifacts"), join(workspaceRoot, "artifacts"));
  const findings = join(durableRoot, "findings.json");
  if (existsSync(findings)) {
    copyTree(findings, join(workspaceRoot, "findings.json"));
  }
}

abstract class BaseTaskEnvironment implements TaskEnvironment {
  readonly id = id("env");
  readonly root: string;
  readonly durableRoot: string;
  status: "ready" | "destroyed" = "ready";
  protected readonly workspaceRoot: string;
  protected readonly hostPathsBlocked: string[] = [];
  private readonly taskWorkspace: TaskWorkspace;

  constructor(
    readonly taskId: string,
    readonly kind: ExecutionProviderKind,
    durableRoot: string,
  ) {
    this.durableRoot = resolve(durableRoot);
    this.root = join(tmpdir(), "aether-env", `${taskId}-${this.id}`);
    this.workspaceRoot = join(this.root, "workspace");
    mkdirSync(this.workspaceRoot, { recursive: true });
    seedWorkspace(this.durableRoot, this.workspaceRoot);
    this.taskWorkspace = new TaskWorkspace(this.workspaceRoot);
  }

  workspace(): TaskWorkspace {
    this.assertReady();
    return this.taskWorkspace;
  }

  abstract probeInside(path: string): IsolationProbe;
  abstract spawn: CommandRunner;

  syncOut(): void {
    if (this.status === "destroyed") return;
    syncWorkspaceOut(this.workspaceRoot, this.durableRoot);
  }

  destroy(): DestroyResult {
    if (this.status !== "destroyed") {
      this.syncOut();
      rmSync(this.root, { recursive: true, force: true });
      this.status = "destroyed";
    }
    return {
      destroyed: true,
      outputsPreserved: true,
      rootGone: !existsSync(this.root),
    };
  }

  record(): TaskIsolationRecord {
    return {
      provider: this.kind,
      environmentId: this.id,
      status: this.status,
      hostPathsBlocked: this.hostPathsBlocked.length,
    };
  }

  noteBlocked(path: string): void {
    if (!this.hostPathsBlocked.includes(path)) this.hostPathsBlocked.push(path);
  }

  protected assertReady(): void {
    if (this.status === "destroyed") {
      throw new Error("Task environment has been torn down.");
    }
  }

  protected mapToInside(hostPath: string): string {
    const workspace = resolve(this.workspaceRoot);
    const abs = resolve(hostPath);
    if (abs === workspace || abs.startsWith(`${workspace}${sep}`)) {
      const rel = relative(workspace, abs).replaceAll("\\", "/");
      return rel ? `/task/${rel}` : "/task";
    }
    return hostPath;
  }
}

class ProcessFilesystemEnvironment extends BaseTaskEnvironment {
  constructor(taskId: string, durableRoot: string) {
    super(taskId, "process-filesystem", durableRoot);
  }

  probeInside(path: string): IsolationProbe {
    this.assertReady();
    const trimmed = path.trim();
    if (trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed)) {
      this.noteBlocked(trimmed);
      return {
        path: trimmed,
        readable: false,
        error: "Absolute host paths are not visible inside the task environment.",
      };
    }
    try {
      this.workspace().readBytes(trimmed);
      return { path: trimmed, readable: true };
    } catch (error) {
      this.noteBlocked(trimmed);
      return {
        path: trimmed,
        readable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  spawn: CommandRunner = (command, args, options) => {
    this.assertReady();
    return spawnSync(command, args, {
      encoding: "utf8",
      cwd: options?.cwd ?? this.workspaceRoot,
      maxBuffer: options?.maxBuffer ?? 8 * 1024 * 1024,
      timeout: options?.timeout,
    });
  };
}

class DockerEnvironment extends BaseTaskEnvironment {
  constructor(taskId: string, durableRoot: string) {
    super(taskId, "docker", durableRoot);
  }

  probeInside(path: string): IsolationProbe {
    this.assertReady();
    const trimmed = path.trim();
    if (trimmed === "/task" || trimmed.startsWith("/task/")) {
      const result = this.execInside("/bin/cat", [trimmed], "/");
      const readable = result.status === 0;
      if (!readable) this.noteBlocked(trimmed);
      return {
        path: trimmed,
        readable,
        error: readable
          ? undefined
          : (result.stderr || result.stdout || "Path is not visible inside the task environment.").trim(),
      };
    }
    this.noteBlocked(trimmed);
    return {
      path: trimmed,
      readable: false,
      error: "Host paths are not mounted into the Docker WorkerEnvironment.",
    };
  }

  spawn: CommandRunner = (command, args, options) => {
    this.assertReady();
    const mapped = args.map((arg) => (arg.startsWith("/") ? this.mapToInside(arg) : arg));
    const cwd = options?.cwd ? this.mapToInside(options.cwd) : "/task";
    return this.execInside(command, mapped, cwd, options?.maxBuffer, options?.timeout);
  };

  private execInside(
    command: string,
    args: string[],
    cwd: string,
    maxBuffer = 8 * 1024 * 1024,
    timeout?: number,
  ): SpawnSyncReturns<string> {
    return spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--network=none",
        "--pull=never",
        "--mount",
        `type=bind,source=${this.workspaceRoot},target=/task`,
        "--workdir",
        cwd,
        dockerImage(),
        command,
        ...args,
      ],
      {
        encoding: "utf8",
        maxBuffer,
        timeout,
      },
    );
  }
}

class UnshareMountEnvironment extends BaseTaskEnvironment {
  private readonly rootfs: string;
  private readonly enterPath: string;

  constructor(taskId: string, durableRoot: string) {
    super(taskId, "unshare-mount", durableRoot);
    this.rootfs = join(this.root, "rootfs");
    mkdirSync(join(this.rootfs, "task"), { recursive: true });
    this.enterPath = join(this.root, "enter.sh");
    writeFileSync(this.enterPath, ENTER_SCRIPT, { mode: 0o755 });
  }

  probeInside(path: string): IsolationProbe {
    this.assertReady();
    const result = this.execInside("/bin/cat", [path], "/");
    const readable = result.status === 0;
    if (!readable) this.noteBlocked(path);
    return {
      path,
      readable,
      error: readable
        ? undefined
        : (result.stderr || result.stdout || "Path is not visible inside the task environment.").trim(),
    };
  }

  spawn: CommandRunner = (command, args, options) => {
    this.assertReady();
    const mapped = args.map((arg) => (arg.startsWith("/") ? this.mapToInside(arg) : arg));
    const cwd = options?.cwd ? this.mapToInside(options.cwd) : "/task";
    return this.execInside(command, mapped, cwd, options?.maxBuffer, options?.timeout);
  };

  private execInside(
    command: string,
    args: string[],
    cwd: string,
    maxBuffer = 8 * 1024 * 1024,
    timeout?: number,
  ): SpawnSyncReturns<string> {
    return spawnSync(
      "unshare",
      [
        "--user",
        "--map-root-user",
        "--mount",
        "--propagation",
        "private",
        "/bin/bash",
        this.enterPath,
        command,
        ...args,
      ],
      {
        encoding: "utf8",
        maxBuffer,
        timeout,
        env: {
          ...process.env,
          AETHER_ROOTFS: this.rootfs,
          AETHER_WORKSPACE: this.workspaceRoot,
          AETHER_CWD: cwd,
        },
      },
    );
  }
}

export class ProcessFilesystemProvider implements ExecutionProvider {
  readonly kind = "process-filesystem" as const;
  create(spec: { taskId: string; durableRoot: string }): TaskEnvironment {
    return new ProcessFilesystemEnvironment(spec.taskId, spec.durableRoot);
  }
}

export class UnshareMountProvider implements ExecutionProvider {
  readonly kind = "unshare-mount" as const;
  create(spec: { taskId: string; durableRoot: string }): TaskEnvironment {
    return new UnshareMountEnvironment(spec.taskId, spec.durableRoot);
  }
}

export class DockerProvider implements ExecutionProvider {
  readonly kind = "docker" as const;
  create(spec: { taskId: string; durableRoot: string }): TaskEnvironment {
    return new DockerEnvironment(spec.taskId, spec.durableRoot);
  }
}

let unshareAvailable: boolean | undefined;
let dockerHealthy: boolean | undefined;

export function detectUnshareMount(): boolean {
  if (unshareAvailable !== undefined) return unshareAvailable;
  const probe = spawnSync("unshare", ["--user", "--map-root-user", "--mount", "true"], {
    encoding: "utf8",
  });
  unshareAvailable = probe.status === 0;
  return unshareAvailable;
}

/** Binary on PATH. Not enough — the daemon may still be down. */
export function detectDocker(): boolean {
  const probe = spawnSync("docker", ["--version"], {
    encoding: "utf8",
    timeout: 2000,
  });
  return probe.status === 0;
}

/** Daemon answers `docker info` and the local image exists (`--pull=never`). */
export function detectDockerHealthy(): boolean {
  if (dockerHealthy !== undefined) return dockerHealthy;
  const info = spawnSync("docker", ["info"], {
    encoding: "utf8",
    timeout: 3000,
  });
  if (info.status !== 0) {
    dockerHealthy = false;
    return false;
  }
  const image = spawnSync("docker", ["image", "inspect", dockerImage()], {
    encoding: "utf8",
    timeout: 3000,
  });
  dockerHealthy = image.status === 0;
  return dockerHealthy;
}

export function dockerImage(): string {
  return process.env.AETHER_DOCKER_IMAGE?.trim() || "python:3.12-slim";
}

export function liveComputeHealth(): ComputeHealth {
  return {
    dockerHealthy: detectDockerHealthy(),
    unshareMount: detectUnshareMount(),
  };
}

export function providerForKind(kind: ExecutionProviderKind): ExecutionProvider {
  if (kind === "docker") return new DockerProvider();
  if (kind === "unshare-mount") return new UnshareMountProvider();
  return new ProcessFilesystemProvider();
}

/**
 * Docker when the daemon is healthy, else unshare-mount, else process-filesystem.
 * `sticky` replays the kind this Task already used. OEM packages and callers
 * do not choose docker vs unshare.
 */
export function selectComputeProvider(options: SelectComputeOptions = {}): ExecutionProvider {
  if (options.sticky) return providerForKind(options.sticky);
  const health = options.health ?? liveComputeHealth();
  if (health.dockerHealthy) return new DockerProvider();
  if (health.unshareMount) return new UnshareMountProvider();
  return new ProcessFilesystemProvider();
}

export function computeBackendNote(health: ComputeHealth = liveComputeHealth()): string {
  if (health.dockerHealthy) {
    return "Docker ComputeProvider is the default because the daemon is healthy. The kind is sticky per Task. OEM packages and customers do not choose docker vs unshare. process-filesystem is a degraded last resort.";
  }
  if (health.unshareMount) {
    return "Docker is the default ComputeProvider when the daemon is healthy. This host's Docker daemon is not healthy, so unshare-mount is selected. The kind is sticky per Task. OEM packages and customers do not pick the backend. process-filesystem is a degraded last resort.";
  }
  return "Docker is the default ComputeProvider when the daemon is healthy, then unshare-mount. Neither is available here, so process-filesystem is the degraded last resort. The kind is sticky per Task. OEM packages and customers do not pick the backend.";
}

export const COMPUTE_BACKEND_NOTE = computeBackendNote();

/** @deprecated use selectComputeProvider */
export const selectExecutionProvider = selectComputeProvider;
