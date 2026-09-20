import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HostUnconfiguredError,
  HostUrlInvalidError,
  buildHostTarget,
  hostApiPath,
  publicHostLabel,
  resolveHostUrl,
} from "./host.ts";

describe("resolveHostUrl", () => {
  it("requires WORKERLAYER_HOST_URL", () => {
    assert.throws(() => resolveHostUrl({}), HostUnconfiguredError);
  });

  it("rejects non-http schemes", () => {
    assert.throws(
      () => resolveHostUrl({ WORKERLAYER_HOST_URL: "file:///tmp/workers" }),
      HostUrlInvalidError,
    );
  });

  it("accepts an https mini host", () => {
    const url = resolveHostUrl({ WORKERLAYER_HOST_URL: "https://mini.example:8443/wl" });
    assert.equal(url.origin, "https://mini.example:8443");
    assert.equal(url.pathname, "/wl");
  });
});

describe("hostApiPath", () => {
  it("prefixes desk aliases onto host /api routes", () => {
    assert.equal(hostApiPath("tasks"), "api/tasks");
    assert.equal(hostApiPath("workers"), "api/workers");
    assert.equal(hostApiPath("/startTask"), "api/startTask");
    assert.equal(hostApiPath("desk/propose"), "api/desk/propose");
  });

  it("does not double-prefix an already-qualified api path", () => {
    assert.equal(hostApiPath("api/tasks"), "api/tasks");
    assert.equal(hostApiPath("/api/workers"), "api/workers");
  });
});

describe("buildHostTarget", () => {
  it("joins under the host base path", () => {
    const host = new URL("https://mini.example/wl");
    const target = buildHostTarget(host, "startTask", "?dry=1");
    assert.equal(target.href, "https://mini.example/wl/startTask?dry=1");
  });

  it("maps the proven tasks alias onto host /api/tasks", () => {
    const host = new URL("https://khokhryakov.net");
    assert.equal(buildHostTarget(host, hostApiPath("tasks")).href, "https://khokhryakov.net/api/tasks");
    assert.equal(buildHostTarget(host, hostApiPath("api/tasks")).href, "https://khokhryakov.net/api/tasks");
  });

  it("refuses off-origin escapes", () => {
    const host = new URL("https://mini.example/wl");
    assert.throws(() => buildHostTarget(host, "https://evil.example/x"), HostUrlInvalidError);
  });
});

describe("publicHostLabel", () => {
  it("hides an unconfigured host", () => {
    assert.deepEqual(publicHostLabel({}), { configured: false, origin: null });
  });
});
