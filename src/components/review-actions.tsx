"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIX_TARGETS, type FixTarget } from "@aether/contracts";
import { Button } from "@/components/ui/button";

export function ReviewActions({
  taskId,
  suggestedTarget,
  sendable = false,
}: {
  taskId: string;
  suggestedTarget: FixTarget;
  sendable?: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<FixTarget>(suggestedTarget);
  const [busy, setBusy] = useState<"accept" | "reject" | "request_fix" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "accept" | "reject" | "request_fix") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "request_fix" ? { action, target } : { action }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not record the review.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the review.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-medium">Your review</p>
      <p className="text-muted-foreground">
        {sendable
          ? "The worker already cleared the draft defects. Accept with 0 fixes unless you see a leftover. A structured fix is optional cleanup, not the default."
          : "Accept the pack, ask for one structured fix, or reject it. This is not a chat."}
      </p>
      <fieldset className="space-y-2">
        <legend className="text-xs text-muted-foreground">If you request one fix</legend>
        {FIX_TARGETS.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="fix-target"
              className="mt-1"
              checked={target === item.id}
              onChange={() => setTarget(item.id)}
              disabled={busy !== null}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy !== null} onClick={() => void submit("accept")}>
          {busy === "accept" ? "Accepting…" : "Accept"}
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() => void submit("request_fix")}
        >
          {busy === "request_fix" ? "Applying one fix…" : "Request one fix"}
        </Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => void submit("reject")}>
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
