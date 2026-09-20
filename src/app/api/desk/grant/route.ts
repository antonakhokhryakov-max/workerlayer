import { NextResponse } from "next/server";
import { requireHumanGrantSelection } from "@aether/runtime";
import { getDeveloperApi } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Desk dogfood. Grantor is desk-session. No API key in the browser. Keyed strangers use POST /api/v1/grant. */
export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }
  try {
    const selection = requireHumanGrantSelection(body as Record<string, unknown>);
    const { environment, task } = getDeveloperApi().grantReviewed(selection);
    return NextResponse.json(
      {
        environment,
        task: { id: task.brief.id, goal: task.brief.goal, status: task.status },
        review: environment.grantReview?.note,
        grant: environment.grantReview,
      },
      { status: 201 },
    );
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error && typeof error.status === "number"
        ? error.status
        : 400;
    const message = error instanceof Error ? error.message : "Could not grant selected tools.";
    return NextResponse.json({ error: message }, { status });
  }
}
