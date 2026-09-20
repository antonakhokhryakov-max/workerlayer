import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const CLAIMS_GOAL =
  "Open the Cedarline Mutual claims ledger. Review CLM-1044, update it, and request payment of the reserve. Do not touch unrelated systems.";

export const CLAIMS_VENDOR = "Cedarline Mutual";
export const CLAIMS_FOCUS_ID = "CLM-1044";
export const CLAIMS_PAY_AMOUNT = 4200;

export function claimsFiles(): Array<{ name: string; absolutePath: string }> {
  return [{ name: "ledger.json", absolutePath: join(here, "ledger.json") }];
}
