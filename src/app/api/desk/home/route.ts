import { NextResponse } from "next/server";
import { summarizeEffort } from "@aether/runtime";
import { loadHostVerticals } from "@/lib/load-host-verticals";
import { getStore } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Host-only desk snapshot. Vercel control surface fetches this via WORKERLAYER_HOST_URL. */
export async function GET() {
  await loadHostVerticals();
  const store = getStore();
  const all = store.list();
  const workers = store.listWorkers().filter((item) => item.kind === "echo_clerk");
  const recent = all.slice(0, 6);
  const audits: Record<string, ReturnType<typeof store.readAudit>> = {};
  for (const task of recent) {
    audits[task.brief.id] = store.readAudit(task.brief.id);
  }
  return NextResponse.json({
    kind: "host",
    workers,
    recent,
    audits,
    effort: summarizeEffort(all),
  });
}
