import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMPUTE_BACKEND_NOTE,
  DockerProvider,
  detectDocker,
  detectDockerHealthy,
  selectComputeProvider,
} from "@aether/workstation";
import { tempStore } from "./helpers";

describe("ComputeProvider selection", () => {
  it("auto-defaults to Docker when the daemon is healthy, else unshare-mount", () => {
    expect(
      selectComputeProvider({ health: { dockerHealthy: true, unshareMount: true } }).kind,
    ).toBe("docker");
    expect(
      selectComputeProvider({ health: { dockerHealthy: false, unshareMount: true } }).kind,
    ).toBe("unshare-mount");
    expect(
      selectComputeProvider({ health: { dockerHealthy: false, unshareMount: false } }).kind,
    ).toBe("process-filesystem");
  });

  it("is sticky per Task even if Docker later looks unhealthy", () => {
    expect(
      selectComputeProvider({
        sticky: "docker",
        health: { dockerHealthy: false, unshareMount: true },
      }).kind,
    ).toBe("docker");
    expect(
      selectComputeProvider({
        sticky: "unshare-mount",
        health: { dockerHealthy: true, unshareMount: true },
      }).kind,
    ).toBe("unshare-mount");
    expect(COMPUTE_BACKEND_NOTE).toMatch(/OEM packages/);
    expect(COMPUTE_BACKEND_NOTE).toMatch(/sticky per Task/);
  });

  it("does not treat docker --version as a healthy daemon", () => {
    if (!detectDocker()) {
      expect(detectDockerHealthy()).toBe(false);
      expect(selectComputeProvider().kind).not.toBe("docker");
    } else if (!detectDockerHealthy()) {
      expect(selectComputeProvider().kind).not.toBe("docker");
    } else {
      expect(selectComputeProvider().kind).toBe("docker");
    }
  });

  it("Docker environments do not mount host paths, even before a container starts", () => {
    const store = tempStore();
    const durable = store.workspaceRoot("tsk_docker_probe");
    mkdirSync(joinSources(durable), { recursive: true });
    writeFileSync(`${joinSources(durable)}/ok.txt`, "in-scope");
    const env = new DockerProvider().create({
      taskId: "tsk_docker_probe",
      durableRoot: durable,
    });
    try {
      expect(env.kind).toBe("docker");
      expect(env.probeInside("/etc/passwd").readable).toBe(false);
      expect(env.probeInside(`${durable}/../secret.txt`).readable).toBe(false);
    } finally {
      const torn = env.destroy();
      expect(torn.rootGone).toBe(true);
      expect(existsSync(`${joinSources(durable)}/ok.txt`)).toBe(true);
    }
  });
});

function joinSources(durable: string): string {
  return `${durable}/sources`;
}
