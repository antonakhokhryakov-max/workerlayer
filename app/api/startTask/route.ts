import { proxyToHost } from "@/lib/proxy";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  return proxyToHost(request, "startTask");
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
