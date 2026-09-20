import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_ALPHA_LABEL,
  PRODUCT_ALPHA_SYNTHETIC,
  PRODUCT_NAME,
  PRODUCT_SUCCESS,
  productStrangerLine,
} from "@aether/contracts";
import { DeveloperApi, authorizeV1, v1HealthBody } from "@aether/runtime";
import { selectComputeProvider } from "@aether/workstation";
import { taskProofLine, trailMark, trailReason } from "../src/lib/task-proof";
import { tempStore } from "./helpers";

describe("Founding Alpha specs", () => {
  it("brands WorkerLayer, not Aether GTM, and says success is a DENY", () => {
    expect(PRODUCT_NAME).toBe("WorkerLayer");
    expect(PRODUCT_ALPHA_LABEL).toMatch(/Alpha — not for sensitive production workloads/);
    expect(PRODUCT_ALPHA_SYNTHETIC).toMatch(/Synthetic or non-sensitive files only/);
    expect(PRODUCT_SUCCESS).toMatch(/ALLOW \/ ALLOW \/ DENY/);
    expect(PRODUCT_SUCCESS).toMatch(/DENY/);
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/^# WorkerLayer/m);
    expect(readme).not.toMatch(/Temporary name/);
    expect(readme.indexOf("WorkerLayer")).toBeLessThan(readme.indexOf("knowledge-work"));
    expect(readme).toMatch(/## 15-minute path \(keyed \/api\/v1\)/);
    expect(readme).toMatch(/ALLOW notes\.read/);
    expect(readme).toMatch(/DENY notes\.export/);
    expect(readme).toMatch(/## OEM second worker — Echo/);
    expect(readme).toMatch(/product name is WorkerLayer/);
    expect(readme).toMatch(/Success is \*\*ALLOW \/ ALLOW \/ DENY\*\*/);
    expect(readme.replace(/AetherPlatform/g, "")).not.toMatch(/\bAether\b/);
    const desk = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(desk).toMatch(/PRODUCT_SUCCESS/);
    expect(desk).toMatch(/PRODUCT_ALPHA_SYNTHETIC/);
    expect(desk).not.toMatch(/Temporary name/);
    expect(desk).toMatch(/not the product/);
    const form = readFileSync(join(process.cwd(), "src/components/assign-form.tsx"), "utf8");
    expect(form).toMatch(/OEM second worker — Echo clerk/);
    expect(form).toMatch(/not the\s+product/);
    expect(form).toMatch(/ALLOW \/ ALLOW \/\s+DENY/);
    const taskPage = readFileSync(join(process.cwd(), "src/app/tasks/[id]/page.tsx"), "utf8");
    expect(taskPage).toMatch(/look for DENY/);
    expect(taskPage).toMatch(/torn down/);
    expect(taskPage).toMatch(/taskProofLine/);
    expect(taskPage).toMatch(/DENY is the product working/);
    expect(taskPage).toMatch(/DENY lines and torn down show here/);
    expect(desk).toMatch(/taskProofLine/);
    expect(desk).toMatch(/GrantReviewForm/);
    const grantForm = readFileSync(join(process.cwd(), "src/components/grant-review-form.tsx"), "utf8");
    expect(grantForm).toMatch(/PRODUCT_SKETCH_REVIEW/);
    expect(grantForm).toMatch(/PRODUCT_SKETCH_LABEL/);
    expect(grantForm).toMatch(/PRODUCT_GRANT_SELECTED/);
    expect(grantForm).toMatch(/PRODUCT_LEFTOVER_DENY/);
    expect(grantForm).toMatch(/confirm: true/);
    expect(grantForm).not.toMatch(/Approve all/);
    expect(grantForm).toMatch(/not approved/);
    expect(grantForm).toMatch(/not enabled/);
    expect(grantForm).not.toMatch(/Approve All/);
    expect(grantForm).not.toMatch(/Enable sketch/);
    expect(grantForm).not.toMatch(/variant="allow"/);
    expect(grantForm).toMatch(/variant="outline"/);
    expect(grantForm).toMatch(/Task-scoped/);
    expect(grantForm).toMatch(/Not a standing ALLOW/);
    expect(grantForm).toMatch(/identity only/);
    expect(grantForm).toMatch(/After the Worker and the job/);
    expect(grantForm).toMatch(/\/api\/desk\/grant/);
    expect(grantForm).not.toMatch(/AETHER_API_KEY/);
    expect(grantForm).not.toMatch(/Authorization/);
    expect(grantForm).not.toMatch(/X-Api-Key/);
    expect(grantForm).not.toMatch(/process\.env/);
    expect(form).not.toMatch(/AETHER_API_KEY/);
    expect(form).not.toMatch(/process\.env/);
    expect(desk).not.toMatch(/AETHER_API_KEY/);
    expect(desk).not.toMatch(/computeProvider/);
    const deskGrant = readFileSync(join(process.cwd(), "src/app/api/desk/grant/route.ts"), "utf8");
    expect(deskGrant).toMatch(/getDeveloperApi\(\)/);
    expect(deskGrant).toMatch(/desk-session/);
    expect(deskGrant).not.toMatch(/actingAs/);
    expect(deskGrant).not.toMatch(/authorizeV1/);
    expect(deskGrant).not.toMatch(/AETHER_API_KEY/);
    const server = readFileSync(join(process.cwd(), "src/lib/server.ts"), "utf8");
    expect(server).toMatch(/new DeveloperApi\(getStore\(\)\)/);
    expect(server).toMatch(/desk-session/);
    expect(server).toMatch(/assertHostCompute/);
    expect(server).not.toMatch(/actingAs/);
    expect(readme).toMatch(/control surface/);
    expect(readme).toMatch(/desk-session/);
    expect(desk).toMatch(/Sketch \/ suggested tools/);
    expect(desk).toMatch(/ExperienceBar/);
    expect(desk).toMatch(/id="assign"/);
    expect(desk).toMatch(/id="trail"/);
    expect(desk).toMatch(/REQUIRE_APPROVAL/);
    expect(desk).toMatch(/Build and run your agent/);
    expect(desk).toMatch(/Agent → Job → Tools/);
    expect(desk).toMatch(/No WorkerEnvironment yet/);
    expect(desk).toMatch(/id="job"/);
    expect(desk).toMatch(/EchoWorkerStart/);
    expect(desk).toMatch(/JobAssign/);
    expect(desk).toMatch(/AgentJobToolsGraphic/);
    expect(desk).toMatch(/loadDeskHome/);
    expect(form).toMatch(/\/api\/workers/);
    expect(form).toMatch(/Give Echo a sample job/);
    expect(form).toMatch(/No WorkerEnvironment yet/);
    const workersRoute = readFileSync(join(process.cwd(), "src/app/api/workers/route.ts"), "utf8");
    expect(workersRoute).toMatch(/ensureWorker/);
    expect(workersRoute).toMatch(/identityOnly: true/);
    expect(workersRoute).not.toMatch(/createTask/);
    expect(workersRoute).not.toMatch(/startTask/);
    expect(workersRoute).not.toMatch(/computeProvider/);
    const marks = readFileSync(join(process.cwd(), "src/components/marks.tsx"), "utf8");
    expect(marks.indexOf('label: "Worker"')).toBeLessThan(marks.indexOf('label: "Goal"'));
    expect(marks.indexOf('label: "Goal"')).toBeLessThan(marks.indexOf('label: "Sketch"'));
    expect(marks.indexOf('label: "Sketch"')).toBeLessThan(marks.indexOf('label: "Grant selected"'));
    expect(desk).toMatch(/PUBLIC_DESK_URL/);
    expect(form).toMatch(/2\. Goal — tell this Worker what to do/);
    expect(taskPage).toMatch(/ExperienceBar/);
    expect(taskPage).toMatch(/REQUIRE_APPROVAL/);
    expect(taskPage).toMatch(/Activity log/);
    expect(taskPage).toMatch(/Grant selected · Task-scoped/);
    expect(taskPage).not.toMatch(/computeProvider/);
    expect(taskPage).not.toMatch(/hostPathsBlocked/);
    expect(taskPage).not.toMatch(/isolation\.provider/);
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/PRODUCT_ALPHA_SYNTHETIC/);
    expect(layout).toMatch(/PRODUCT_SUCCESS/);
    expect(layout).toMatch(/PUBLIC_DESK_URL/);
    expect(layout).not.toMatch(/AETHER_API_KEY/);
    expect(readme).toMatch(/https:\/\/lauderdale-mar-seemed-circle\.trycloudflare\.com/);
    expect(readme).not.toMatch(/Open \[http:\/\/127\.0\.0\.1:43147\]/);
    expect(readme).not.toMatch(/open http:\/\/127\.0\.0\.1:43147/i);
    expect(desk).not.toMatch(/127\.0\.0\.1/);
    const publicDesk = readFileSync(join(process.cwd(), "src/lib/public-desk.ts"), "utf8");
    expect(publicDesk).toMatch(/https:\/\/lauderdale-mar-seemed-circle\.trycloudflare\.com/);
    expect(publicDesk).toMatch(/temporary-cloudflare-quick-tunnel/);
    expect(publicDesk).toMatch(/control surface/);
    expect(publicDesk).toMatch(/not a lasting Vercel/);
    expect(publicDesk).toMatch(/Founding Engineer restarts/);
    expect(readme).toMatch(/\*\*temporary Cloudflare quick tunnel\*\*/);
    expect(readme).toMatch(/Founding Engineer keeps `pnpm dev`/);
    expect(readme).toMatch(/new URL each restart/);
    expect(
      taskProofLine({
        allowTools: ["notes.read", "notes.write"],
        denyTools: ["notes.export"],
        approvalTools: [],
        tornDown: true,
        identityExpired: true,
      }),
    ).toBe("DENY notes.export · torn down");
    expect(
      trailMark({
        id: "aud_1",
        taskId: "tsk_1",
        timestamp: "2026-01-01T00:00:00.000Z",
        actor: "user",
        action: "tool.invoke",
        decision: "require_approval",
        tool: "claims.pay",
        details: { reason: "Needs a human" },
      }),
    ).toBe("REQUIRE_APPROVAL");
    expect(
      trailReason({
        id: "aud_2",
        taskId: "tsk_1",
        timestamp: "2026-01-01T00:00:00.000Z",
        actor: "user",
        action: "manifest.grant",
        details: { grantor: "desk-session", capabilitiesAdded: ["notes:read"] },
      }),
    ).toMatch(/desk-session/);
    expect(
      trailReason({
        id: "aud_2",
        taskId: "tsk_1",
        timestamp: "2026-01-01T00:00:00.000Z",
        actor: "user",
        action: "manifest.grant",
        details: { grantor: "desk-session", capabilitiesAdded: ["notes:read"] },
      }),
    ).toMatch(/Not a standing ALLOW/);
  });

  it("documents control plane, BYO loop, sticky Docker, and 15-minute DENY", () => {
    const alpha = readFileSync(join(process.cwd(), "docs/ALPHA.md"), "utf8");
    expect(alpha).toMatch(/identity only/);
    expect(alpha).toMatch(/missing_api_key/);
    expect(alpha).toMatch(/invalid_api_key/);
    expect(alpha).toMatch(/\b404\b/);
    expect(alpha).toMatch(/notes\.read/);
    expect(alpha).toMatch(/notes\.write/);
    expect(alpha).toMatch(/notes\.export/);
    expect(alpha).toMatch(/cannot self-grant/);
    expect(alpha).toMatch(/docker info/);
    expect(alpha).toMatch(/sticky per Task/);
    expect(alpha).toMatch(/do not choose/);
    expect(alpha).toMatch(/Success is \*\*ALLOW \/ ALLOW \/ DENY\*\*/);
    expect(alpha).toMatch(/Echo clerk/);
    expect(alpha).toMatch(/not a knowledge-worker GTM/);
    expect(alpha).toMatch(/python3 clients\/python\/example\.py/);
    expect(alpha).toMatch(/Proposal is not a grant/);
    expect(alpha).toMatch(/grantFromProposal/);
    expect(alpha).toMatch(/confirm=True/);
    expect(alpha).toMatch(/c\.grant/);
    expect(alpha).toMatch(/Task-scoped/);
    expect(alpha).toMatch(/Grant selected/);
    expect(alpha).toMatch(/status.*sketch/);
    expect(alpha).toMatch(/grantor/);
    expect(alpha).toMatch(/sketch id\/hash/);
    expect(alpha).toMatch(/OEM does not choose/);
    expect(alpha).toMatch(/audit records the provider/);
    expect(alpha).toMatch(/Outsider registerWorker checklist/);
    expect(alpha).toMatch(/test_cross_principal_404/);
    expect(alpha).toMatch(/not the product/);
    expect(alpha).toMatch(/do \*\*not\*\* edit `runtime\/src\/builtins\.ts`/i);
    expect(alpha).toMatch(/See also/);
    expect(alpha).toMatch(/DESK-URL\.md/);
    const deskUrlPlan = readFileSync(join(process.cwd(), "docs/DESK-URL.md"), "utf8");
    expect(deskUrlPlan).toMatch(/^# Durable public desk URL \(Alpha\)/m);
    expect(deskUrlPlan).toMatch(/temporary/);
    expect(deskUrlPlan).toMatch(/Vercel is not connected/);
    expect(deskUrlPlan).toMatch(/not in the browser/);
    expect(deskUrlPlan).toMatch(/desk-session/);
    expect(deskUrlPlan).toMatch(/AETHER_API_KEY/);
    expect(deskUrlPlan).toMatch(/one product fork/i);
    expect(deskUrlPlan).toMatch(/Fork Host/);
    expect(deskUrlPlan).toMatch(/Fork Split/);
    expect(deskUrlPlan).toMatch(/Vercel is not connected|does \*\*not\*\* speak Origin/);
    expect(deskUrlPlan).toMatch(/would run Workers on Vercel/);
    expect(deskUrlPlan).toMatch(/both lasting ships blocked/);
    expect(deskUrlPlan).toMatch(/Mac mini/);
    expect(deskUrlPlan).toMatch(/control surface/);
    expect(deskUrlPlan).toMatch(/Create repo|github.com\/new/);
    expect(deskUrlPlan).toMatch(/Add New/);
    expect(deskUrlPlan).toMatch(/Import Git Repository/);
    expect(deskUrlPlan).toMatch(/Environment Variables/);
    expect(deskUrlPlan).toMatch(/Deploy/);
    expect(deskUrlPlan).toMatch(/WORKERLAYER_HOST_URL/);
    expect(deskUrlPlan).toMatch(/source of truth/);
    expect(deskUrlPlan).toMatch(/Vercel-import mirror/);
    expect(deskUrlPlan).toMatch(/not the product SoT|not product SoT/);
    expect(deskUrlPlan).toMatch(/cursor worker start/);
    expect(deskUrlPlan).toMatch(/pnpm start/);
    expect(deskUrlPlan).toMatch(/missing_host_url/);
    expect(deskUrlPlan).toMatch(/no SSO/i);
    expect(deskUrlPlan).not.toMatch(/open http:\/\/127\.0\.0\.1:43147/i);
    expect(deskUrlPlan).toMatch(/Alpha — not for sensitive production workloads/);
    const vercelJson = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    expect(vercelJson).toMatch(/nextjs/);
    expect(vercelJson).not.toMatch(/startTask/);
    const middleware = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    expect(middleware).toMatch(/WORKERLAYER_HOST_URL|hostUrl/);
    expect(middleware).toMatch(/missing_host_url/);
    expect(middleware).toMatch(/matcher: "\/api\/:path\*"/);
    const deskData = readFileSync(join(process.cwd(), "src/lib/desk-data.ts"), "utf8");
    expect(deskData).toMatch(/listWorkers/);
    expect(deskData).toMatch(/isControlSurface/);
    expect(alpha).toMatch(/DX\.md/);
    expect(alpha).toMatch(/OEM\.md/);
    expect(alpha).toMatch(/Openable desk/);
    expect(alpha).toMatch(/control surface/);
    expect(alpha).toMatch(/desk-session/);
    expect(alpha).toMatch(/not in the browser/);
    expect(alpha).toMatch(/https:\/\/lauderdale-mar-seemed-circle\.trycloudflare\.com/);
    expect(alpha).toMatch(/temporary/);
    expect(alpha).toMatch(/not a lasting Vercel/);
    expect(alpha).toMatch(/Founding Engineer keeps `pnpm dev`/);
    expect(alpha).not.toMatch(/Desk at \[http:\/\/127\.0\.0\.1:43147\]/);
    expect(alpha).not.toMatch(/open http:\/\/127\.0\.0\.1:43147/i);
    const dx = readFileSync(join(process.cwd(), "docs/DX.md"), "utf8");
    expect(dx).toMatch(/^# 15-minute DX path \(WorkerLayer Alpha\)/m);
    expect(dx).toMatch(/ALPHA\.md/);
    expect(dx).toMatch(/OEM\.md/);
    expect(dx).toMatch(/torn down/);
    expect(dx).toMatch(/Review → grant/);
    expect(dx).toMatch(/Grant selected/);
    expect(dx).toMatch(/Task-scoped/);
    const oem = readFileSync(join(process.cwd(), "docs/OEM.md"), "utf8");
    expect(oem).toMatch(/See also/);
    expect(oem).toMatch(/ALPHA\.md/);
    expect(oem).toMatch(/DX\.md/);
    expect(oem).toMatch(/WorkerLayer/);
    expect(alpha).toMatch(/explicit grant act/);
    expect(alpha).toMatch(/desk-session/);
    expect(oem).toMatch(/explicit grant act/);
    expect(oem).toMatch(/desk-session/);
    expect(alpha).toMatch(/assert proposal\["granted"\] is False/);
    expect(alpha).not.toMatch(/granted": true/);
    expect(alpha).toMatch(/SECURITY\.md/);
    const security = readFileSync(join(process.cwd(), "docs/SECURITY.md"), "utf8");
    expect(security).toMatch(/Identity ≠ authorization/);
    expect(security).toMatch(/is identity only/);
    expect(security).toMatch(/CapabilityManifest decides tools/);
    expect(security).toMatch(/who you are, not what you may do/);
    expect(security).toMatch(/ALPHA\.md/);
    expect(security).toMatch(/host process is fully compromised/);
    expect(security).toMatch(/Same-machine residual risk/);
    expect(security).toMatch(/not a VM/);
    expect(security).toMatch(/no SSO/);
    expect(security).toMatch(/human-selected tool list/);
    expect(security).toMatch(/does not copy a sketch/);
    expect(security).toMatch(/Task-scoped/);
    expect(security).toMatch(/API key alone does not grant/);
    expect(security).toMatch(/explicit grant act/);
    expect(security).toMatch(/desk-session/);
  });

  it("does not auto-grant, add SSO, install Docker, or add a new vertical", () => {
    const http = readFileSync(join(process.cwd(), "runtime/src/developer-http.ts"), "utf8");
    expect(http).not.toMatch(/grantFromProposal/);
    expect(http).toMatch(/granted: false/);
    expect(http).toMatch(/requireHumanGrantSelection/);
    expect(http).toMatch(/Unknown developer API route/);
    const python = readFileSync(join(process.cwd(), "clients/python/aether.py"), "utf8");
    expect(python).toMatch(/def propose/);
    expect(python).toMatch(/def grant/);
    expect(python).not.toMatch(/grant_from_proposal/);
    const stubs = readFileSync(join(process.cwd(), "control-plane/src/stubs.ts"), "utf8");
    expect(stubs).toMatch(/Interfaces only — not implemented/);
    expect(stubs).toMatch(/authenticate\(\): Promise<never>/);
    expect(stubs).toMatch(/is not built/);
    expect(stubs).not.toMatch(/Okta|SAML|oauth/i);
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(readme).toMatch(/does not install a Docker daemon/);
    expect(readme).not.toMatch(/apt-get install[^\n]*docker/i);
    expect(readme).toMatch(/POST \/api\/v1\/grant/);
    expect(readme).toMatch(/Grant selected/);
    expect(readme).toMatch(/confirm: true/);
    const verticals = JSON.parse(
      readFileSync(join(process.cwd(), "aether.verticals.json"), "utf8"),
    ) as { verticals: string[] };
    expect(verticals.verticals).toEqual([
      "./packages/vertical-echo",
      "./packages/vertical-knowledge",
      "./packages/vertical-claims",
      "./packages/vertical-staff",
    ]);
  });

  it("keeps the API key as identity and leaves the desk unkeyed", () => {
    const missing = authorizeV1({}, "alpha-key");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.body.code).toBe("missing_api_key");
    const wrong = authorizeV1({ authorization: "Bearer nope" }, "alpha-key");
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.body.code).toBe("invalid_api_key");
    const desk = readFileSync(join(process.cwd(), "src/app/api/tasks/route.ts"), "utf8");
    expect(desk).not.toMatch(/authorizeV1/);
    const health = v1HealthBody();
    expect(health.product).toBe("WorkerLayer");
    expect(health.stranger).toBe(productStrangerLine(selectComputeProvider().kind));
    expect(String(health.stranger)).toMatch(/sticky per Task/);
    expect(String(health.stranger)).toMatch(/ALLOW \/ ALLOW \/ DENY/);
    expect(String(health.stranger)).toMatch(/propose does not grant/);
    expect(health.compute).toMatchObject({
      provider: selectComputeProvider().kind,
      stickyPerTask: true,
      customerChooses: false,
      oemChooses: false,
    });
  });

  it("ignores customer computeProvider / substrate on create_environment", async () => {
    const api = new DeveloperApi(tempStore());
    const environment = api.createEnvironment({
      worker: "dock-notes",
      tools: [
        { name: "notes.read", capability: "notes:read", policy: "allow" },
        { name: "notes.write", capability: "notes:write", policy: "allow" },
        { name: "notes.export", capability: "notes:export", policy: "deny" },
      ],
      computeProvider: "docker",
      substrate: "COMPUTER",
      substrates: ["MCP_TOOL"],
    });
    const created = api.createTask({
      environmentId: environment.id,
      goal: "Read, write, do not export.",
    });
    api.attachFile(created.brief.id, { name: "slip.txt", content: "North dock is closed." });
    const ran = await api.run(created.brief.id, {
      requests: [
        { tool: "notes.read", args: { path: "slip.txt" } },
        { tool: "notes.write", args: { path: "hold.txt", text: "Hold." } },
        { tool: "notes.export", args: { destination: "https://not-authorized.example" } },
      ],
    });
    expect(ran.environment?.computeProvider).toBe(selectComputeProvider().kind);
    expect(ran.environment?.substrates).toEqual(["DIRECT_TOOL"]);
    expect(ran.environment?.substrates).not.toContain("COMPUTER");
    expect(ran.environment?.substrates).not.toContain("MCP_TOOL");
    const audit = api.audit(created.brief.id);
    expect(audit.some((event) => event.tool === "notes.read" && event.decision === "allow")).toBe(
      true,
    );
    expect(audit.some((event) => event.tool === "notes.write" && event.decision === "allow")).toBe(
      true,
    );
    expect(audit.some((event) => event.tool === "notes.export" && event.decision === "deny")).toBe(
      true,
    );
    const createdEnv = audit.find((event) => event.action === "environment.created");
    expect(createdEnv?.details.provider).toBe(selectComputeProvider().kind);
    expect(createdEnv?.details.stickyPerTask).toBe(true);
  }, 60_000);
});
