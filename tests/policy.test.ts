import { describe, expect, it } from "vitest";
import {
  AuditLog,
  ControlPlane,
  defaultKnowledgeWorkCapabilities,
  evaluatePolicy,
} from "@aether/control-plane";
import type { ActionRequest } from "@aether/contracts";
import { id } from "@aether/contracts";
import { TaskWorkspace, Workstation } from "@aether/workstation";
import { newBrief } from "@aether/runtime";
import { tempStore } from "./helpers";

function request(tool: ActionRequest["tool"], args: Record<string, unknown>): ActionRequest {
  return {
    id: id("req"),
    taskId: "tsk_test",
    tool,
    args,
    requestedBy: "agent",
  };
}

describe("policy deny and approval paths", () => {
  const capabilities = defaultKnowledgeWorkCapabilities("/tmp/aether-ws");

  it("denies files outside the task workspace", () => {
    expect(evaluatePolicy(request("workspace.read_file", { path: "/etc/passwd" }), capabilities).decision).toBe("deny");
    expect(
      evaluatePolicy(request("workspace.read_file", { path: "../secret.txt" }), capabilities)
        .decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(request("pdf.extract_text", { path: "artifacts/hidden.pdf" }), capabilities)
        .decision,
    ).toBe("deny");
    expect(evaluatePolicy(request("pdf.ocr", { path: "/etc/passwd" }), capabilities).decision).toBe("deny");
    expect(evaluatePolicy(request("pdf.ocr", { path: "tsk_other/sources/scan.pdf" }), capabilities).decision).toBe(
      "deny",
    );
    expect(evaluatePolicy(request("pdf.ocr", { path: "sources/shop-floor-scan.pdf" }), capabilities).decision).toBe(
      "allow",
    );
  });

  it("allows an allowlisted fetch without granting open-web fetch", () => {
    const allowlisted = defaultKnowledgeWorkCapabilities("/tmp/aether-ws", [
      "https://notes.fir-ridge.example/profile",
    ]);
    expect(
      evaluatePolicy(
        request("network.fetch", { url: "https://notes.fir-ridge.example/profile" }),
        allowlisted,
      ).decision,
    ).toBe("allow");
    expect(
      evaluatePolicy(request("network.fetch", { url: "https://news.example/search" }), allowlisted)
        .decision,
    ).toBe("deny");
    expect(
      evaluatePolicy(
        request("network.fetch", { url: "https://notes.lakeshore.example/mossline-customers" }),
        allowlisted,
      ).decision,
    ).toBe("deny");
  });

  it("denies unauthorized destinations and exports", () => {
    const denied = evaluatePolicy(
      request("network.fetch", { url: "https://evil.example/exfil" }),
      capabilities,
    );
    expect(denied.decision).toBe("deny");
    expect(denied.reason).toMatch(/capability|not authorized/i);

    const exportDenied = evaluatePolicy(
      request("export.send_external", { destination: "https://dropbox.example/upload" }),
      capabilities,
    );
    expect(exportDenied.decision).toBe("deny");
  });

  it("requires approval for sensitive external actions and executes only after approval", async () => {
    const store = tempStore();
    const brief = { ...newBrief("Probe a sensitive destination", []), id: "tsk_test" };
    const workspace = new TaskWorkspace(store.workspaceRoot(brief.id));
    const plane = new ControlPlane(
      new AuditLog(store.auditPath(brief.id)),
      defaultKnowledgeWorkCapabilities(store.workspaceRoot(brief.id)),
      brief,
    );
    const workstation = new Workstation(workspace, plane.grantVerifier());

    const pending = await plane.dispatch(
      request("export.send_external", {
        destination: "https://partner-api.example",
        filename: "findings.xlsx",
      }),
      workstation,
    );
    expect(pending.decision.decision).toBe("require_approval");
    expect(pending.result.status).toBe("pending_approval");
    expect(pending.result.approvalId).toBeTruthy();

    const denied = await plane.resolveApproval(
      pending.result.approvalId!,
      "denied",
      "operator",
      workstation,
    );
    expect(denied.ticket.status).toBe("denied");
    expect(denied.handled).toBeUndefined();

    const again = await plane.dispatch(
      request("export.send_external", {
        destination: "https://partner-api.example",
        filename: "findings.xlsx",
      }),
      workstation,
    );
    const approved = await plane.resolveApproval(
      again.result.approvalId!,
      "approved",
      "operator",
      workstation,
    );
    expect(approved.ticket.status).toBe("approved");
    expect(approved.handled?.result.ok).toBe(true);
    expect(approved.handled?.result.data?.simulated).toBe(true);
  });

  it("refuses workstation execution without a control-plane grant", async () => {
    const store = tempStore();
    const brief = newBrief("Grant check", []);
    const plane = new ControlPlane(
      new AuditLog(store.auditPath(brief.id)),
      defaultKnowledgeWorkCapabilities(store.workspaceRoot(brief.id)),
      brief,
    );
    const workstation = new Workstation(
      new TaskWorkspace(store.workspaceRoot(brief.id)),
      plane.grantVerifier(),
    );
    const forged = request("workspace.list_files", {});
    const result = await workstation.execute(forged, {
      grantId: "grt_forged",
      requestId: forged.id,
      taskId: brief.id,
      tool: "workspace.list_files",
      argsDigest: "nope",
      issuedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/grant/i);
  });
});
