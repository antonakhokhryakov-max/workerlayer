import { NextResponse } from "next/server";
import { reviewTask } from "@aether/runtime";
import type { FixTarget, ReviewAction } from "@aether/contracts";
import { FIX_TARGETS } from "@aether/contracts";
import { getStore } from "@/lib/server";

const ACTIONS = new Set<ReviewAction>(["accept", "reject", "request_fix"]);
const TARGETS = new Set<FixTarget>(FIX_TARGETS.map((item) => item.id));

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { action?: ReviewAction; target?: FixTarget };
  if (!body.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Choose accept, reject, or request one fix." }, { status: 400 });
  }
  if (body.target && !TARGETS.has(body.target)) {
    return NextResponse.json({ error: "That is not a structured fix target." }, { status: 400 });
  }

  const store = getStore();
  if (!store.get(id)) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  try {
    const task = await reviewTask(store, id, body.action, body.target);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record the review." },
      { status: 400 },
    );
  }
}
