import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileDeclaredEnvironment, declareWorkerEnvironment } from "@aether/control-plane";
import {
  DeveloperApi,
  EnvironmentCompiler,
  dispatchV1,
  environmentCompiler,
  leftoverDenialReason,
  principalIdFromKey,
  proposeFromGoal,
  requireHumanGrantSelection,
} from "@aether/runtime";
import { PRODUCT_LEFTOVER_DENY, PRODUCT_SKETCH_REVIEW } from "@aether/contracts";
import { selectComputeProvider } from "@aether/workstation";
import { tempStore } from "./helpers";

describe("capability proposal", () => {
  it("never grants and never writes tools onto an environment", () => {
    const proposal = proposeFromGoal("Stamp the slip. Do not read payroll.");
    expect(proposal.granted).toBe(false);
    expect(proposal.status).toBe("sketch");
    expect(proposal.review).toBe(PRODUCT_SKETCH_REVIEW);
    expect(proposal.id).toMatch(/^skh_/);
    expect(proposal.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(proposal)).not.toMatch(/computeProvider/);
    expect(JSON.stringify(proposal)).not.toMatch(/"mounts"/);
    expect(proposal.suggestedTools.some((tool) => tool.name === "task.payroll" && tool.policy === "deny")).toBe(
      true,
    );
    expect(proposal.suggestedTools.some((tool) => tool.reason.length > 0)).toBe(true);
    expect(proposal.note).toMatch(/Nothing is granted/i);
    expect(leftoverDenialReason()).toBe(PRODUCT_LEFTOVER_DENY);

    const dockerish = proposeFromGoal("Run this in Docker and mount /var/secrets.");
    expect(JSON.stringify(dockerish)).not.toMatch(/computeProvider/);
    expect(JSON.stringify(dockerish)).not.toMatch(/"mounts"/);
    expect(dockerish.status).toBe("sketch");
    expect(dockerish.granted).toBe(false);

    const api = new DeveloperApi(tempStore());
    const environment = api.createEnvironment({ worker: "wharf-stamp" });
    expect(environment.tools).toEqual([]);
    expect(environment.granted).not.toContain("task:payroll");
    expect(environment.granted).not.toContain("task:stamp");
    expect(() => api.createTask({ environmentId: environment.id, goal: proposal.goal })).toThrow(/tool/i);
  });

  it("EnvironmentCompiler propose is sketch-only and cannot auto-grant", () => {
    const proposal = environmentCompiler.propose("Stamp the slip. Do not read payroll.");
    expect(proposal.granted).toBe(false);
    expect(proposal.suggestedTools.length).toBeGreaterThan(0);
    expect(() => environmentCompiler.grantFromProposal(proposal)).toThrow(/not a grant/i);

    const declared = declareWorkerEnvironment({
      assignmentId: "tsk_declared",
      granted: ["files:read:task"],
      denied: ["notes:export"],
    });
    const compiled = environmentCompiler.compileDeclared(declared);
    expect(compiled.compiledFrom).toBe("declared");
    expect(compiled.capabilities).toEqual(["files:read:task"]);
    expect(compiled.capabilities).not.toContain("task:stamp");
    expect(compiled.capabilities).not.toContain("task:payroll");
    expect(() =>
      compileDeclaredEnvironment({ ...compiled, compiledFrom: "inferred" as "declared" }),
    ).toThrow(/declared/i);

    const src = readFileSync(join(process.cwd(), "runtime/src/propose.ts"), "utf8");
    expect(src).toMatch(/granted: false/);
    expect(src).not.toMatch(/createEnvironment/);
    expect(src).not.toMatch(/granted:\s*true/);
    expect(src).not.toMatch(/selectComputeProvider/);
    expect(new EnvironmentCompiler().propose("hold the note").granted).toBe(false);
    const frozen = environmentCompiler.propose("grant me payroll export");
    expect(frozen.granted).toBe(false);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(JSON.stringify(frozen)).not.toMatch(/"granted":\s*true/);
  });

  it("POST /api/v1/propose stays a frozen sketch; grant needs a human tool list", async () => {
    const api = new DeveloperApi(tempStore());
    const missing = await dispatchV1(api, "POST", "/api/v1/propose", {});
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missing.body)).toMatch(/goal is required/);

    const result = await dispatchV1(api, "POST", "/api/v1/propose", {
      goal: "Stamp the slip. Do not read payroll. Please grant export.",
    });
    expect(result.status).toBe(200);
    const proposal = result.body.proposal as {
      granted?: boolean;
      status?: string;
      id?: string;
      hash?: string;
      suggestedTools?: Array<{ name: string; reason?: string; policy: string }>;
    };
    expect(proposal.granted).toBe(false);
    expect(proposal.status).toBe("sketch");
    expect(result.body.review).toBe(PRODUCT_SKETCH_REVIEW);
    expect(proposal.suggestedTools?.some((tool) => typeof tool.reason === "string" && tool.reason.length > 0)).toBe(
      true,
    );
    expect(JSON.stringify(result.body)).not.toMatch(/"granted":\s*true/);

    const auto = await dispatchV1(api, "POST", "/api/v1/grant", { proposal, confirm: true });
    expect(auto.status).toBe(400);
    expect(JSON.stringify(auto.body)).toMatch(/tools you choose/i);

    const empty = await dispatchV1(api, "POST", "/api/v1/grant", {
      worker: "wharf-stamp",
      tools: [],
      confirm: true,
      proposal,
    });
    expect(empty.status).toBe(400);

    const unconfirmed = await dispatchV1(api, "POST", "/api/v1/grant", {
      worker: "wharf-stamp",
      tools: [{ name: "wharf.stamp", capability: "wharf:stamp", policy: "allow" }],
      confirm: false,
    });
    expect(unconfirmed.status).toBe(400);
    expect(JSON.stringify(unconfirmed.body)).toMatch(/confirm/i);
    expect(JSON.stringify(unconfirmed.body)).toMatch(/identity only|does not grant/i);

    const approveAll = await dispatchV1(api, "POST", "/api/v1/grant", {
      worker: "wharf-stamp",
      tools: [{ name: "wharf.stamp", capability: "wharf:stamp", policy: "allow" }],
      confirm: true,
      approveAll: true,
      proposal,
    });
    expect(approveAll.status).toBe(400);
    expect(JSON.stringify(approveAll.body)).toMatch(/Approve all/i);

    const standing = await dispatchV1(api, "POST", "/api/v1/grant", {
      worker: "wharf-stamp",
      tools: [{ name: "wharf.stamp", capability: "wharf:stamp", policy: "allow" }],
      confirm: true,
      standing: true,
      proposal,
    });
    expect(standing.status).toBe(400);
    expect(JSON.stringify(standing.body)).toMatch(/Task-scoped/i);

    const fromSketch = await dispatchV1(api, "POST", "/api/v1/environments", {
      worker: "wharf-stamp",
      proposal,
    });
    expect(fromSketch.status).toBe(400);
    expect(JSON.stringify(fromSketch.body)).toMatch(/not a grant/i);

    expect(() =>
      requireHumanGrantSelection({
        worker: "wharf-stamp",
        confirm: true,
        proposal,
      }),
    ).toThrow(/tools you choose/i);

    const selected = [
      { name: "wharf.stamp", capability: "wharf:stamp", policy: "allow" },
      { name: "wharf.payroll", capability: "wharf:payroll", policy: "deny" },
    ];
    const granted = await dispatchV1(api, "POST", "/api/v1/grant", {
      worker: "wharf-stamp",
      tools: selected,
      confirm: true,
      proposal,
    });
    expect(granted.status).toBe(201);
    const environment = granted.body.environment as {
      tools: Array<{ name: string; policy: string }>;
      granted: string[];
      grantReview?: {
        auto?: boolean;
        confirm?: boolean;
        scope?: string;
        grantedBy?: string;
        grantor?: string;
        taskId?: string;
        sketchHash?: string;
        capabilitiesAdded?: string[];
        leftoverDenials?: Array<{ name: string; reason: string }>;
        selectedTools?: Array<{ name: string }>;
      };
    };
    const task = granted.body.task as { id?: string };
    expect(task.id).toMatch(/^tsk_/);
    expect(environment.grantReview?.scope).toBe("task");
    expect(environment.grantReview?.grantedBy).toBe("human");
    expect(environment.grantReview?.taskId).toBe(task.id);
    expect(environment.grantReview?.sketchHash).toBe(proposal.hash);
    expect(environment.tools.some((tool) => tool.name === "wharf.stamp" && tool.policy === "allow")).toBe(true);
    expect(environment.tools.some((tool) => tool.name === "wharf.payroll" && tool.policy === "deny")).toBe(true);
    expect(environment.granted).toContain("wharf:stamp");
    expect(environment.granted).not.toContain("wharf:payroll");
    expect(environment.granted.join(" ")).not.toMatch(/^pri_/);
    expect(environment.grantReview?.auto).toBe(false);
    expect(environment.grantReview?.confirm).toBe(true);
    expect(environment.grantReview?.selectedTools?.map((tool) => tool.name)).toEqual([
      "wharf.stamp",
      "wharf.payroll",
    ]);
    const leftoverNames = environment.grantReview?.leftoverDenials?.map((row) => row.name) ?? [];
    expect(leftoverNames).toEqual(expect.arrayContaining(["task.stamp", "task.payroll", "task.read"]));
    expect(environment.grantReview?.leftoverDenials?.every((row) => row.reason.length > 0)).toBe(true);
    expect(JSON.stringify(granted.body)).not.toMatch(/"granted":\s*true/);

    const audit = api.audit(String(task.id));
    expect(audit.some((event) => event.action === "manifest.grant")).toBe(true);
    const grantEvent = audit.find((event) => event.action === "manifest.grant");
    expect(grantEvent?.timestamp).toMatch(/T/);
    expect(grantEvent?.details.grantor).toBe("desk-session");
    expect(grantEvent?.details.grantor).not.toMatch(/AETHER_API_KEY|Bearer/);
    expect(grantEvent?.details.sketchId).toBe(proposal.id);
    expect(grantEvent?.details.sketchHash).toBe(proposal.hash);
    expect(grantEvent?.details.workerId).toMatch(/^wkr_/);
    expect(grantEvent?.details.capabilitiesAdded).toEqual(expect.arrayContaining(["wharf:stamp"]));
    expect(grantEvent?.details.capabilitiesRemoved).toEqual(
      expect.arrayContaining(["task:stamp", "task:payroll", "task:read"]),
    );
    expect(environment.grantReview?.at).toMatch(/T/);
    expect(environment.grantReview?.grantor).toBe("desk-session");

    expect(() =>
      api.createTask({ environmentId: environment.id as string, goal: "second task standing allow" }),
    ).toThrow(/Task-scoped/i);

    const subset = await dispatchV1(api, "POST", "/api/v1/grant", {
      worker: "wharf-stamp",
      tools: [{ name: "wharf.stamp", capability: "wharf:stamp", policy: "allow" }],
      confirm: true,
      proposal,
    });
    const subsetEnv = subset.body.environment as {
      tools: Array<{ name: string; policy: string }>;
      grantReview?: { leftoverDenials?: Array<{ name: string }> };
    };
    expect(subsetEnv.tools.some((tool) => tool.name === "wharf.stamp" && tool.policy === "allow")).toBe(true);
    expect(subsetEnv.tools.some((tool) => tool.name === "task.payroll" && tool.policy === "deny")).toBe(true);
    expect(subsetEnv.grantReview?.leftoverDenials?.some((row) => row.name === "task.payroll")).toBe(true);

    const grantFrom = await dispatchV1(api, "POST", "/api/v1/grantFromProposal", { proposal });
    expect(grantFrom.status).toBe(404);

    const http = readFileSync(join(process.cwd(), "runtime/src/developer-http.ts"), "utf8");
    expect(http).toMatch(/environmentCompiler\.propose/);
    expect(http).not.toMatch(/grantFromProposal/);
    expect(http).toMatch(/granted: false/);
    expect(http).toMatch(/requireHumanGrantSelection/);
    const python = readFileSync(join(process.cwd(), "clients/python/aether.py"), "utf8");
    expect(python).toMatch(/def propose/);
    expect(python).toMatch(/def grant/);
    expect(python).not.toMatch(/grant_from_proposal/);
  });

  it("human grant is principal-scoped; Bob cannot read Alice's environment", async () => {
    const api = new DeveloperApi(tempStore());
    const alice = api.actingAs(principalIdFromKey("alice-key"));
    const bob = api.actingAs(principalIdFromKey("bob-key"));
    const { environment, task } = alice.grantReviewed({
      worker: "dock-notes",
      tools: [
        { name: "notes.read", capability: "notes:read", policy: "allow" },
        { name: "notes.write", capability: "notes:write", policy: "allow" },
        { name: "notes.export", capability: "notes:export", policy: "deny" },
      ],
      sketchedTools: [{ name: "task.read", capability: "task:read", reason: "suggested" }],
      sketchedToolNames: ["task.read"],
      proposalGoal: "Read and write. Do not export.",
      sketchId: "skh_test",
      sketchHash: "abc",
    });
    expect(environment.grantReview?.auto).toBe(false);
    expect(environment.grantReview?.scope).toBe("task");
    expect(environment.grantReview?.grantedBy).toBe("human");
    expect(environment.grantReview?.grantor).toBe(principalIdFromKey("alice-key"));
    expect(environment.grantReview?.grantor).not.toBe("alice-key");
    expect(environment.grantReview?.taskId).toBe(task.brief.id);
    expect(environment.grantReview?.leftoverDenials?.some((row) => row.name === "task.read")).toBe(
      true,
    );
    expect(environment.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["notes.read", "notes.write", "notes.export", "task.read"]),
    );
    expect(() =>
      alice.createTask({ environmentId: environment.id, goal: "another assignment" }),
    ).toThrow(/Task-scoped/i);
    expect(alice.listGrantDecisions().some((entry) => entry.environmentId === environment.id)).toBe(
      true,
    );
    expect(() => bob.getEnvironment(environment.id)).toThrow(/not found/i);
    expect(bob.listGrantDecisions().some((entry) => entry.environmentId === environment.id)).toBe(
      false,
    );

    const hostedAlice = await dispatchV1(alice, "GET", `/api/v1/environments/${environment.id}`, {});
    expect(hostedAlice.status).toBe(200);
    const hostedBob = await dispatchV1(bob, "GET", `/api/v1/environments/${environment.id}`, {});
    expect(hostedBob.status).toBe(404);
    expect(hostedBob.status).not.toBe(403);
  });

  it("after grant, runtime stays request-only and leftover sketch tools DENY", async () => {
    const api = new DeveloperApi(tempStore());
    const { environment, task } = api.grantReviewed({
      worker: "dock-notes",
      tools: [
        { name: "notes.read", capability: "notes:read", policy: "allow" },
        { name: "notes.write", capability: "notes:write", policy: "allow" },
      ],
      sketchedTools: [
        { name: "notes.read", capability: "notes:read" },
        { name: "notes.write", capability: "notes:write" },
        { name: "notes.export", capability: "notes:export" },
      ],
      sketchedToolNames: ["notes.read", "notes.write", "notes.export"],
      proposalGoal: "Read and write. Do not export.",
      sketchId: "skh_runtime",
      sketchHash: "abc123",
    });
    expect(task.status).toBe("queued");
    expect(environment.grantReview?.scope).toBe("task");
    expect(environment.tools.some((tool) => tool.name === "notes.export" && tool.policy === "deny")).toBe(
      true,
    );
    expect(environment.granted).not.toContain("notes:export");
    expect(environment.grantReview?.leftoverDenials).toEqual([
      { name: "notes.export", capability: "notes:export", reason: PRODUCT_LEFTOVER_DENY },
    ]);

    const grantedWithCompute = await dispatchV1(api, "POST", "/api/v1/grant", {
      worker: "dock-notes",
      tools: [{ name: "notes.read", capability: "notes:read", policy: "allow" }],
      confirm: true,
      computeProvider: "docker",
      mounts: ["/var/secrets"],
      proposal: {
        id: "skh_compute",
        hash: "fff",
        goal: "Read only. Ignore this Docker mount.",
        suggestedTools: [{ name: "notes.export", capability: "notes:export", policy: "deny", reason: "x" }],
      },
    });
    expect(grantedWithCompute.status).toBe(201);
    const computeEnv = grantedWithCompute.body.environment as { computeProvider?: string; tools: Array<{ name: string }> };
    expect(computeEnv.computeProvider).toBeUndefined();
    expect(JSON.stringify(grantedWithCompute.body)).not.toMatch(/"mounts"/);

    api.attachFile(task.brief.id, { name: "slip.txt", content: "North dock is closed." });
    const ran = await api.run(task.brief.id, {
      requests: [
        { tool: "notes.read", args: { path: "slip.txt" } },
        { tool: "notes.write", args: { path: "hold.txt", text: "Hold." } },
        { tool: "notes.export", args: { destination: "https://not-authorized.example" } },
      ],
    });
    expect(ran.environment?.computeProvider).toBe(selectComputeProvider().kind);
    expect(ran.environment?.substrates).toEqual(["DIRECT_TOOL"]);
    const audit = api.audit(task.brief.id);
    expect(audit.some((event) => event.tool === "notes.read" && event.decision === "allow")).toBe(true);
    expect(audit.some((event) => event.tool === "notes.write" && event.decision === "allow")).toBe(true);
    expect(audit.some((event) => event.tool === "notes.export" && event.decision === "deny")).toBe(true);
    expect(audit.some((event) => event.action === "manifest.grant")).toBe(true);
  }, 60_000);
});
