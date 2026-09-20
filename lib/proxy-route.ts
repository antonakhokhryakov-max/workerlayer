import type { NextRequest } from "next/server";
import { proxyToHost } from "./proxy.ts";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function proxyHostPath(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxyToHost(request, path.join("/"));
}

export function hostAliasHandlers(prefix: string) {
  const handle = async (request: NextRequest, context: RouteContext) => {
    const { path = [] } = await context.params;
    const joined = [prefix, ...path].filter(Boolean).join("/");
    return proxyToHost(request, joined);
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
