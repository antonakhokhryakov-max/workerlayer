import { NextResponse } from "next/server";
import { groundTruthPath } from "@aether/runtime";
import { getPlatform, getStore } from "@/lib/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plat = getPlatform();
  const task = plat.getTask(id) ?? getStore().get(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  const isBenchmark = task.brief.sourceFiles.some((file) =>
    file.name.includes("cedar-current-addendum") || file.name.includes("market-landscape"),
  );
  const result = plat.startTask(id, {
    groundTruthPath: isBenchmark ? groundTruthPath() : undefined,
  });
  if (!result.started && result.reason !== "Already running.") {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  return NextResponse.json({ started: true, status: "running", workerId: task.brief.workerId });
}
