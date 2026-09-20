import { NextResponse } from "next/server";
import type { WorkerKind } from "@aether/contracts";
import { getWorkerRegistration } from "@aether/runtime";
import { loadHostVerticals } from "@/lib/load-host-verticals";
import { getPlatform, getStore } from "@/lib/server";

function summarize(worker: {
  id: string;
  name: string;
  kind: string;
  status: string;
  createdAt: string;
  taskIds: string[];
}) {
  return {
    id: worker.id,
    name: worker.name,
    kind: worker.kind,
    status: worker.status,
    createdAt: worker.createdAt,
    taskCount: worker.taskIds.length,
    identityOnly: true,
  };
}

export async function GET() {
  await loadHostVerticals();
  const workers = getStore().listWorkers().map(summarize);
  return NextResponse.json({ workers });
}

/** Identity only. No Task, no Manifest grant, no WorkerEnvironment, no compute picker. */
export async function POST(request: Request) {
  await loadHostVerticals();
  let body: { kind?: unknown } = {};
  try {
    body = (await request.json()) as { kind?: unknown };
  } catch {
    body = {};
  }
  const kind = (typeof body.kind === "string" && body.kind ? body.kind : "echo_clerk") as WorkerKind;
  const registration = getWorkerRegistration(kind);
  if (!registration) {
    return NextResponse.json(
      {
        error:
          kind === "echo_clerk"
            ? "Echo is not loaded. Add packages/vertical-echo to aether.verticals.json. Do not edit builtins.ts. See docs/OEM.md."
            : `Unknown Worker kind ${kind}. Register a package. Do not edit builtins.ts.`,
      },
      { status: 503 },
    );
  }
  const worker = getPlatform().ensureWorker(kind);
  return NextResponse.json({ worker: summarize(worker) }, { status: 201 });
}
