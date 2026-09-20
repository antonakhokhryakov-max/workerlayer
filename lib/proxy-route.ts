import type { NextRequest } from "next/server";
import { hostApiPath } from "./host.ts";
import { proxyToHost } from "./proxy.ts";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function proxyHostPath(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxyToHost(request, hostApiPath(path.join("/")));
}

export function hostAliasHandlers(prefix: string) {
  const handle = async (request: NextRequest, context: RouteContext) => {
    const { path = [] } = await context.params;
    const joined = [prefix, ...path].filter(Boolean).join("/");
    return proxyToHost(request, hostApiPath(joined));
  };

  return {
    GET: handle,
    POST: handle,
    PUT: handle,
    PATCH: handle,
    DELETE: handle,
    HEAD: handle,
  };
}
