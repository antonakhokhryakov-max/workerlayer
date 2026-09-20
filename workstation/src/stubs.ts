/**
 * Slots that are not adapters yet.
 * python.execute is real (SandboxAdapter). Full browser and a general shell are not.
 */

export interface BrowserResearchPort {
  open(_url: string): Promise<never>;
}

export interface ShellPort {
  exec(_command: string): Promise<never>;
}
