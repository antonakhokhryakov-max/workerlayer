"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ApprovalActions({
  taskId,
  approvalId,
}: {
  taskId: string;
  approvalId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resolve(decision: "approved" | "denied") {
    setBusy(true);
    await fetch(`/api/tasks/${taskId}/approvals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, decision }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy} onClick={() => resolve("approved")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve("denied")}>
        Deny
      </Button>
    </div>
  );
}
