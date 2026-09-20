import { NextResponse } from "next/server";
import { environmentCompiler } from "@aether/runtime";

export const dynamic = "force-dynamic";

/** Desk dogfood. Keyed strangers use POST /api/v1/propose. */
export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const goal =
    body && typeof body === "object" && typeof (body as { goal?: unknown }).goal === "string"
      ? (body as { goal: string }).goal
      : "";
  try {
    const proposal = environmentCompiler.propose(goal);
    return NextResponse.json({ proposal, review: proposal.review });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sketch tools.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
