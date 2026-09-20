import { hostAliasHandlers } from "@/lib/proxy-route";

export const dynamic = "force-dynamic";

export const { GET, POST, PUT, PATCH, DELETE, HEAD } = hostAliasHandlers("tasks");
