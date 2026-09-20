import { NextResponse } from "next/server";
import { queueDiligenceTask } from "@aether/runtime";
import { getPlatform } from "@/lib/server";

export async function POST() {
  const plat = getPlatform();
  const task = queueDiligenceTask(plat);
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
