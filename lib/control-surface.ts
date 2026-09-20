/**
 * WorkerLayer Vercel desk is a control surface only.
 *
 * Never implement Workers runtime, startTask execution, or Manifest exec
 * in this repository's Next.js server. Those stay on the Mac mini host
 * reached through WORKERLAYER_HOST_URL.
 */
export const PRODUCT_NAME = "WorkerLayer" as const;

export const HOST_EXEC_PREFIXES = [
  "workers",
  "startTask",
  "start-task",
  "tasks",
  "manifest",
] as const;

export const VERCEL_MUST_NOT_RUN = [
  "Workers",
  "startTask",
  "Manifest exec",
] as const;

export function isHostExecPath(path: string): boolean {
  const head = path.replace(/^\/+/, "").split("/")[0] ?? "";
  return (HOST_EXEC_PREFIXES as readonly string[]).includes(head);
}
