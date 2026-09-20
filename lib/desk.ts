import { PRODUCT_NAME, VERCEL_MUST_NOT_RUN } from "./control-surface.ts";
import { publicHostLabel } from "./host.ts";
import { STAGE, getGrantId, getIdentityKey, maskIdentityKey } from "./stage.ts";

export type DeskInfo = {
  product: string;
  surface: string;
  stage: {
    id: number;
    name: string;
    grantMode: string;
    keyKind: string;
    sso: boolean;
    computePicker: boolean;
  };
  grant: { id: string; mode: string; selected: boolean };
  key: { kind: string; present: boolean; masked: string | null };
  sso: boolean;
  computePicker: boolean;
  host: { configured: boolean; origin: string | null };
  vercelMustNotRun: string[];
};

export function getDeskInfo(): DeskInfo {
  const host = publicHostLabel();
  const identity = getIdentityKey();

  return {
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
    vercelMustNotRun: [...VERCEL_MUST_NOT_RUN],
  };
}
