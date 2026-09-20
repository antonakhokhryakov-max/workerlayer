import { Desk } from "@/components/desk";
import { getDeskInfo } from "@/lib/desk";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Desk initialDesk={getDeskInfo()} />;
}
