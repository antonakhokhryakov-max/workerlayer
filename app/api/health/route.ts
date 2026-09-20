import { PRODUCT_NAME } from "@/lib/control-surface";
import { publicHostLabel } from "@/lib/host";
import { STAGE } from "@/lib/stage";

export const dynamic = "force-dynamic";

export function GET() {
  const host = publicHostLabel();

  return Response.json({
    ok: true,
    product: PRODUCT_NAME,
    surface: "vercel-desk",
    stage: STAGE.id,
    hostConfigured: host.configured,
  });
}
