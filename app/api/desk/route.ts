import { PRODUCT_NAME, VERCEL_MUST_NOT_RUN } from "@/lib/control-surface";
import { publicHostLabel } from "@/lib/host";
import { STAGE, getGrantId, getIdentityKey, maskIdentityKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

export function GET() {
  const host = publicHostLabel();
  const identity = getIdentityKey();

  return Response.json({
    product: PRODUCT_NAME,
    surface: "vercel-desk",
    stage: STAGE,
    grant: {
      id: getGrantId(),
      mode: STAGE.grantMode,
      selected: true,
    },
    key: {
      kind: STAGE.keyKind,
      present: Boolean(identity),
      masked: maskIdentityKey(identity),
    },
    sso: false,
    computePicker: false,
    host,
    vercelMustNotRun: VERCEL_MUST_NOT_RUN,
  });
}
