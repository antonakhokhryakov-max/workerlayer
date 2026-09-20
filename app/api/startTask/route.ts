import { hostApiPath } from "@/lib/host";
import { proxyToHost } from "@/lib/proxy";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return proxyToHost(request, hostApiPath("desk/propose"));
  }

  const incoming = await request.json().catch(() => ({}));
  const record = incoming && typeof incoming === "object" ? (incoming as Record<string, unknown>) : {};
  const explicitGoal = typeof record.goal === "string" ? record.goal.trim() : "";
  const composed = [record.title, record.input]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n\n");
  const goal = explicitGoal || composed;

  return proxyToHost(
    new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify({ ...record, goal }),
    }),
    hostApiPath("desk/propose"),
  );
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
