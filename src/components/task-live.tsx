"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function TaskLive({
  taskId,
  status,
  runningMessage,
}: {
  taskId: string;
  status: string;
  runningMessage?: string;
}) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if ((status === "queued" || status === "failed") && !started.current) {
      started.current = true;
      void fetch(`/api/tasks/${taskId}/run`, { method: "POST" }).then(() => {
        router.refresh();
      });
    }
  }, [status, taskId, router]);

  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const timer = setInterval(() => router.refresh(), 1200);
    return () => clearInterval(timer);
  }, [status, router]);

  if (status !== "queued" && status !== "running") return null;

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/60 px-4 py-3 text-sm">
      {status === "queued"
        ? "Starting the assignment in the governed task environment…"
        : runningMessage ??
          "The worker is requesting tools. The control plane decides. You do not prompt it."}
    </div>
  );
}
