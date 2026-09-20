import { NextResponse } from "next/server";
import { loadHostVerticals } from "@/lib/load-host-verticals";
import { loadTaskPreviews } from "@/lib/previews";
import { getStore } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Host-only task page payload. Vercel control surface fetches this via WORKERLAYER_HOST_URL. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await loadHostVerticals();
  const store = getStore();
  const task = store.get(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  const worker = task.brief.workerId ? store.getWorker(task.brief.workerId) : undefined;
  const manifest = task.brief.capabilityManifestId
    ? store.getManifest(task.brief.capabilityManifestId)
    : undefined;
  const grantReview = task.brief.environmentId
    ? store.getEnvironment(task.brief.environmentId)?.grantReview
    : undefined;
  return NextResponse.json({
    kind: "host",
    task,
    audit: store.readAudit(id),
    approvals: store.loadApprovals(id),
    sources: store.listSources(id),
    worker,
    manifest,
    grantReview,
    previews: loadTaskPreviews(store, id, task.artifacts),
  });
}
