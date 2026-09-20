import { NextResponse } from "next/server";
import type { StoredTask } from "@aether/runtime";
import { getPlatform, getStore } from "@/lib/server";

export async function GET() {
  const tasks = getStore().list().map(summarize);
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const goal = String(form.get("goal") ?? "").trim();
  if (!goal) {
    return NextResponse.json({ error: "A goal is required." }, { status: 400 });
  }

  const uploads = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "Attach at least one source file." }, { status: 400 });
  }

  const plat = getPlatform();
  const worker = plat.ensureWorker("knowledge");
  const fileContents = await Promise.all(
    uploads.map(async (file) => ({
      name: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    })),
  );
  const task = plat.createTask(worker.id, { goal, fileContents });
  return NextResponse.json({ task: summarize(task) });
}

function summarize(task: StoredTask) {
  return {
    id: task.brief.id,
    goal: task.brief.goal,
    status: task.status,
    company: task.company,
    summary: task.summary,
    createdAt: task.brief.createdAt,
    findingCount: task.findings.length,
    artifacts: task.artifacts,
    workerId: task.brief.workerId,
  };
}
