import { getDeskInfo } from "@/lib/desk";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getDeskInfo());
}
