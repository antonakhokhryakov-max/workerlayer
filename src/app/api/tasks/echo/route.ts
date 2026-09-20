import { NextResponse } from "next/server";
import { getWorkerRegistration } from "@aether/runtime";
import { loadHostVerticals } from "@/lib/load-host-verticals";
import { getPlatform } from "@/lib/server";

/** Job step: create a Task on the Echo Worker. Identity-only spin-up is POST /api/workers. */
export async function POST() {
  await loadHostVerticals();
  const registration = getWorkerRegistration("echo_clerk");
  if (!registration) {
    return NextResponse.json(
      { error: "Echo is not loaded. Add packages/vertical-echo to aether.verticals.json. Do not edit builtins.ts. See docs/OEM.md." },
      { status: 503 },
    );
  }
  const plat = getPlatform();
  const worker = plat.ensureWorker("echo_clerk");
  const task = plat.createTask(worker.id, {
    goal: registration.defaultGoal ?? "Echo the attached line.",
    fileContents: [{ name: "note.md", bytes: "ping" }],
    registeredTools: registration.defaultTools,
  });
  return NextResponse.json({
    task: {
      id: task.brief.id,
      goal: task.brief.goal,
      status: task.status,
      workerId: task.brief.workerId,
      capabilityManifestId: task.brief.capabilityManifestId,
    },
  });
}
