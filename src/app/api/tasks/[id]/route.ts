import { NextResponse } from "next/server";
import { getStore } from "@/lib/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getStore();
  const task = store.get(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  return NextResponse.json({
    task,
    audit: store.readAudit(id),
    approvals: store.loadApprovals(id),
    sources: store.listSources(id),
  });
}
