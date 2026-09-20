import { describe, expect, it } from "vitest";
import {
  assertHostCompute,
  ControlSurfaceError,
  hostUrl,
  isControlSurface,
  isVercelRuntime,
  MISSING_HOST_BODY,
} from "../src/lib/host-mode";

describe("host-mode control surface", () => {
  it("treats Vercel as control surface even without HOST_URL", () => {
    const env = { VERCEL: "1" };
    expect(isVercelRuntime(env)).toBe(true);
    expect(isControlSurface(env)).toBe(true);
    expect(hostUrl(env)).toBeUndefined();
    expect(() => assertHostCompute("startTask", env)).toThrow(ControlSurfaceError);
  });

  it("treats WORKERLAYER_HOST_URL as control surface and never as the mini", () => {
    const env = { WORKERLAYER_HOST_URL: "https://mini.example/" };
    expect(hostUrl(env)).toBe("https://mini.example");
    expect(isControlSurface(env)).toBe(true);
    expect(() => assertHostCompute("WorkerEnvironment", env)).toThrow(/never on Vercel/);
  });

  it("allows in-process compute on the host (no Vercel, no HOST_URL)", () => {
    const env = {};
    expect(isControlSurface(env)).toBe(false);
    expect(() => assertHostCompute("startTask", env)).not.toThrow();
    expect(MISSING_HOST_BODY.code).toBe("missing_host_url");
  });
});
