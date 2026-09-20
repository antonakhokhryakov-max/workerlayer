import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHostExecPath } from "./control-surface.ts";
import { hostUnconfiguredPayload, proxyToHost } from "./proxy.ts";

describe("control surface invariant", () => {
  it("treats Workers, startTask, and Manifest as host exec paths", () => {
    assert.equal(isHostExecPath("workers/alpha"), true);
    assert.equal(isHostExecPath("startTask"), true);
    assert.equal(isHostExecPath("manifest/exec"), true);
    assert.equal(isHostExecPath("desk"), false);
  });
});

describe("proxyToHost", () => {
  it("returns 503 and never fetches when the host URL is missing", async () => {
    let fetched = false;
    const response = await proxyToHost(new Request("http://desk.local/api/host/startTask"), "startTask", {
      env: {},
      fetch: async () => {
        fetched = true;
        throw new Error("must not run locally or fetch without a host");
      },
    });

    assert.equal(response.status, 503);
    assert.equal(fetched, false);
    assert.deepEqual(await response.json(), hostUnconfiguredPayload());
  });

  it("forwards startTask to the mini host with an identity-only key", async () => {
    const seen: { url: string; headers: Headers; method: string }[] = [];

    const response = await proxyToHost(
      new Request("http://desk.local/api/startTask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "ping" }),
      }),
      "startTask",
      {
        env: {
          WORKERLAYER_HOST_URL: "https://mini.example/wl",
          WORKERLAYER_IDENTITY_KEY: "id-key-9f3a",
        },
        fetch: async (input, init) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          seen.push({ url, headers: new Headers(init?.headers), method: String(init?.method) });
          return Response.json({ ok: true, ranOn: "mini" }, { status: 202 });
        },
      },
    );

    assert.equal(response.status, 202);
    assert.equal(response.headers.get("x-workerlayer-proxied"), "1");
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.url, "https://mini.example/wl/startTask");
    assert.equal(seen[0]?.method, "POST");
    assert.equal(seen[0]?.headers.get("x-workerlayer-identity"), "id-key-9f3a");
    assert.equal(seen[0]?.headers.get("x-workerlayer-key-kind"), "identity-only");
    assert.equal(seen[0]?.headers.get("x-workerlayer-surface"), "vercel-desk");
    assert.deepEqual(await response.json(), { ok: true, ranOn: "mini" });
  });
});
