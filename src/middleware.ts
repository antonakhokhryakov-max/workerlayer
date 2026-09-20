import { NextResponse, type NextRequest } from "next/server";
import { hostUrl, isVercelRuntime, MISSING_HOST_BODY } from "@/lib/host-mode";

/**
 * Vercel (or any control-surface process with WORKERLAYER_HOST_URL) must not
 * run startTask in-process. Proxy /api to the Mac mini host instead.
 */
export async function middleware(request: NextRequest) {
  const host = hostUrl();
  if (!host) {
    if (isVercelRuntime()) {
      // 503 missing_host_url — Vercel is control surface only.
      return NextResponse.json(MISSING_HOST_BODY, { status: 503 });
    }
    return NextResponse.next();
  }

  const dest = `${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-workerlayer-control-surface", "1");

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
  };
  if (hasBody) {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(dest, init);
  const out = new Headers(upstream.headers);
  out.delete("content-encoding");
  out.delete("content-length");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export const config = {
  matcher: "/api/:path*",
};
