import { NextResponse } from "next/server";
import { authorizeV1, dispatchV1 } from "@aether/runtime";
import { getDeveloperApi } from "@/lib/server";

export const dynamic = "force-dynamic";

async function handle(request: Request, path: string[]) {
  const auth = authorizeV1(request.headers);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  let body: unknown = {};
  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
      }
    }
  }
  const result = await dispatchV1(
    getDeveloperApi().actingAs(auth.principalId),
    request.method,
    path.join("/"),
    body,
  );
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handle(request, path);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return handle(request, path);
}
