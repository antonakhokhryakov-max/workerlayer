import type { ActionResult } from "@aether/contracts";
import type { TaskWorkspace } from "./workspace";

export const CLAIMS_LEDGER_SOURCE = "sources/ledger.json";
export const CLAIMS_LEDGER_ARTIFACT = "artifacts/claims/ledger.json";

export interface ClaimRecord {
  id: string;
  policyholder: string;
  loss: string;
  reserve: number;
  status: string;
  note?: string;
  paidAmount?: number;
}

export interface ClaimsLedger {
  insurer: string;
  desk: string;
  claims: ClaimRecord[];
}

function fail(error: string): ActionResult {
  return { ok: false, status: "failed", error };
}

function loadLedger(workspace: TaskWorkspace): ClaimsLedger {
  const raw = workspace.exists(CLAIMS_LEDGER_ARTIFACT)
    ? workspace.readBytes(CLAIMS_LEDGER_ARTIFACT).toString("utf8")
    : workspace.readBytes(CLAIMS_LEDGER_SOURCE).toString("utf8");
  return JSON.parse(raw) as ClaimsLedger;
}

function saveLedger(workspace: TaskWorkspace, ledger: ClaimsLedger): void {
  workspace.writeBytes(CLAIMS_LEDGER_ARTIFACT, JSON.stringify(ledger, null, 2));
}

export function executeClaimsRead(workspace: TaskWorkspace): ActionResult {
  const ledger = loadLedger(workspace);
  saveLedger(workspace, ledger);
  return {
    ok: true,
    status: "succeeded",
    data: {
      insurer: ledger.insurer,
      claims: ledger.claims,
      path: CLAIMS_LEDGER_ARTIFACT,
      kind: "file",
      title: "Cedarline claims ledger",
    },
  };
}

export function executeClaimsUpdate(
  workspace: TaskWorkspace,
  args: Record<string, unknown>,
): ActionResult {
  const claimId = String(args.claimId ?? args.id ?? "");
  const ledger = loadLedger(workspace);
  const claim = ledger.claims.find((item) => item.id === claimId);
  if (!claim) return fail(`Claim ${claimId || "(missing)"} was not found.`);
  if (typeof args.status === "string" && args.status.trim()) claim.status = args.status.trim();
  if (typeof args.note === "string") claim.note = args.note;
  saveLedger(workspace, ledger);
  return {
    ok: true,
    status: "succeeded",
    data: {
      claim,
      path: CLAIMS_LEDGER_ARTIFACT,
      kind: "file",
      title: "Cedarline claims ledger",
    },
  };
}

export function executeClaimsPay(
  workspace: TaskWorkspace,
  args: Record<string, unknown>,
): ActionResult {
  const claimId = String(args.claimId ?? args.id ?? "");
  const amount = Number(args.amount);
  const ledger = loadLedger(workspace);
  const claim = ledger.claims.find((item) => item.id === claimId);
  if (!claim) return fail(`Claim ${claimId || "(missing)"} was not found.`);
  if (!Number.isFinite(amount) || amount <= 0) return fail("A payment amount is required.");
  claim.status = "paid";
  claim.paidAmount = amount;
  claim.note = typeof args.note === "string" ? args.note : `Paid ${amount} after operator approval.`;
  saveLedger(workspace, ledger);
  return {
    ok: true,
    status: "succeeded",
    data: {
      claim,
      path: CLAIMS_LEDGER_ARTIFACT,
      kind: "file",
      title: "Cedarline claims ledger",
      message: `${claim.id} paid ${amount} after operator approval.`,
    },
  };
}
