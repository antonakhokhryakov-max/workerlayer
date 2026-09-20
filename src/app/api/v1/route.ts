import { NextResponse } from "next/server";
import { authorizeV1, v1HealthBody } from "@aether/runtime";

export const dynamic = "force-dynamic";

/** GET /api/v1 — keyed health. Desk UI does not use this. */
export async function GET(request: Request) {
  const auth = authorizeV1(request.headers);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  return NextResponse.json(v1HealthBody());
}
