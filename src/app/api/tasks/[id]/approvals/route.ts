import { NextResponse } from "next/server";
import { resolveTaskApproval } from "@aether/runtime";
import { getStore } from "@/lib/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    approvalId?: string;
    decision?: "approved" | "denied";
  };
  if (!body.approvalId || !body.decision) {
    return NextResponse.json({ error: "approvalId and decision are required." }, { status: 400 });
  }

  const store = getStore();
  const task = store.get(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  await resolveTaskApproval(store, id, body.approvalId, body.decision);
  return NextResponse.json({
    task: store.get(id),
    approvals: store.loadApprovals(id),
    audit: store.readAudit(id),
  });
}
