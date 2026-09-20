"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkerGlyph } from "@/components/marks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE_GOAL =
  "Review the attached materials and research the companies using approved sources. Create a comparison spreadsheet covering business model, customers, funding, product capabilities and key differentiators. Then create a 10-slide market overview summarizing the landscape and your major findings. Cite sources and clearly flag information that could not be verified.";

export function EchoWorkerStart() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [worker, setWorker] = useState<{ id: string; name: string; kind: string } | null>(null);

  async function startEcho() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "echo_clerk" }),
      });
      const json = (await response.json()) as {
        error?: string;
        worker?: { id: string; name: string; kind: string };
      };
      if (!response.ok || !json.worker) {
        throw new Error(json.error ?? "Could not spin up Echo.");
      }
      setWorker(json.worker);
      router.refresh();
      document.getElementById("job")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not spin up Echo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="min-w-0">
        <p className="text-sm font-medium">OEM second worker — Echo clerk</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          WorkerLayer is the platform. Echo is the default second Worker, not the
          product. This step is identity only — no tools, no Manifest, no standing
          ALLOW. No WorkerEnvironment yet. Stranger package at
          packages/vertical-echo, loaded from aether.verticals.json. Not listed in
          builtins.ts. Copy it — docs/OEM.md. ALLOW echo.write, DENY echo.secrets.
          Platform success is ALLOW / ALLOW / DENY. Harbor and Claims are extra
          dogfood under the job step. Alpha — not for sensitive production workloads.
          Synthetic files only.
        </p>
      </div>
      {worker ? (
        <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm ring-1 ring-foreground/8">
          <span className="font-mono text-xs">{worker.id}</span>
          {" · "}
          {worker.name}. Identity only. No Task yet. No standing ALLOW. Next: tell
          it the job.
        </p>
      ) : null}
      <Button size="lg" onClick={() => void startEcho()} disabled={busy}>
        {busy ? "Spinning up Echo…" : "Spin up the Echo Worker"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        Identity only. A job is the next card — tools are still not granted here.
      </p>
    </div>
  );
}

export function JobAssign() {
  const router = useRouter();
  const [goal, setGoal] = useState(SAMPLE_GOAL);
  const [busy, setBusy] = useState<
    | "own"
    | "sample"
    | "benchmark"
    | "diligence"
    | "approved"
    | "claims"
    | "staff_weekly"
    | "staff_investor"
    | "echo"
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function go(
    path: string,
    kind:
      | "own"
      | "sample"
      | "benchmark"
      | "diligence"
      | "approved"
      | "claims"
      | "staff_weekly"
      | "staff_investor"
      | "echo",
    body?: FormData,
  ) {
    setError(null);
    setBusy(kind);
    try {
      const response = await fetch(path, { method: "POST", body });
      const json = (await response.json()) as { error?: string; task?: { id: string } };
      if (!response.ok || !json.task) {
        throw new Error(json.error ?? "Could not assign the task.");
      }
      router.push(`/tasks/${json.task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the task.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void go("/api/tasks", "own", new FormData(event.currentTarget));
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label htmlFor="goal" className="text-sm font-medium">
            2. Goal — tell this Worker what to do
          </label>
          <p className="text-sm leading-6 text-muted-foreground">
            The job is a Task. A WorkerEnvironment can start only after this exists —
            sticky per Task, not a picker.
          </p>
          <Textarea
            id="goal"
            name="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={5}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="files" className="text-sm font-medium">
            Source files
          </label>
          <Input id="files" name="files" type="file" multiple required />
          <p className="text-xs text-muted-foreground">
            Attach the materials for this job. The agent may only read these files. Originals are kept immutable.
          </p>
        </div>
        <Button type="submit" variant="outline" disabled={busy !== null}>
          {busy === "own" ? "Saving the job…" : "Give it this job"}
        </Button>
      </form>

      <div className="space-y-3 rounded-2xl px-5 py-4 ring-1 ring-foreground/8">
        <p className="text-sm font-medium">Echo sample job</p>
        <p className="text-sm leading-6 text-muted-foreground">
          Creates a Task on the Echo Worker. A WorkerEnvironment starts only once
          this job exists — sticky per Task. You do not pick compute. Sketch /
          Grant selected is next if you are naming tools yourself.
        </p>
        <Button
          variant="outline"
          onClick={() => void go("/api/tasks/echo", "echo")}
          disabled={busy !== null}
        >
          {busy === "echo" ? "Saving the job…" : "Give Echo a sample job"}
        </Button>
      </div>

      <details className="rounded-2xl px-5 py-4 ring-1 ring-foreground/8">
        <summary className="cursor-pointer text-sm font-medium">More example jobs</summary>
        <div className="mt-4 space-y-5">
          <div>
            <div className="flex items-start gap-3">
              <WorkerGlyph kind="staff" className="size-10 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">North Dock chief of staff</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Instinct for a startup chief of staff — a vertical on WorkerLayer. Same
                  persistent Worker, two Tasks, two CapabilityManifests. Weekly leadership
                  prep cannot draft the investor letter. The investor draft cannot write
                  the internal agenda. Payroll and another assignment&apos;s files are
                  denied. Alpha — not for sensitive production workloads.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => go("/api/tasks/staff/weekly", "staff_weekly")} disabled={busy !== null} variant="outline">
                {busy === "staff_weekly" ? "Preparing the assignment…" : "Prep weekly leadership sync"}
              </Button>
              <Button
                variant="outline"
                onClick={() => go("/api/tasks/staff/investor", "staff_investor")}
                disabled={busy !== null}
              >
                {busy === "staff_investor" ? "Preparing the assignment…" : "Draft investor update"}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-start gap-3">
              <WorkerGlyph kind="claims" className="size-10 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Cedarline Claims Agent</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Extra dogfood on the same plane — not the default second-worker demo.
                  That demo is the Echo clerk (external package) above. Read and update
                  are allowed. Paying a claim needs your approval. Unrelated data is
                  denied. Claims is not a product line.
                </p>
              </div>
            </div>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => go("/api/tasks/claims", "claims")}
              disabled={busy !== null}
            >
              {busy === "claims" ? "Preparing the assignment…" : "Assign the Cedarline claims agent"}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium">Approved web note</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Fir Ridge Cooperage — attached files leave sales and the lead customer blank.
              One approved destination may be fetched. The open web is still denied. The
              recovered facts should land in the pack with 0 fixes.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => go("/api/tasks/approved", "approved")}
              disabled={busy !== null}
            >
              {busy === "approved" ? "Preparing the assignment…" : "Assign the approved web note"}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium">Supplier diligence pack</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Six millwork and canvas vendors, overlapping memos, a recoverable mill-invoice
              scan, and an intentionally unreadable warehouse-hold scan. One figure comes
              back from OCR; the other is flagged, not invented. WorkerLayer should finish a
              comparison spreadsheet and a short presentation by itself — including the
              quality loop, a real authorization deny, and 0 fixes when the loop did its job.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => go("/api/tasks/diligence", "diligence")}
              disabled={busy !== null}
            >
              {busy === "diligence" ? "Preparing the assignment…" : "Assign Ironwharf diligence"}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium">Milestone 1 assignment</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Eighteen outdoor-living companies, several PDFs, missing fields, and one planted
              contradiction. Mossline Shelters&apos; named customers live only on one approved
              note — the open web is still denied. WorkerLayer should finish a comparison
              spreadsheet and a 10-slide overview by itself, including the quality loop and
              0 fixes when that loop did its job.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => go("/api/tasks/benchmark", "benchmark")}
              disabled={busy !== null}
            >
              {busy === "benchmark" ? "Preparing the assignment…" : "Assign the market comparison"}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium">Smaller single-company pack</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Harbor &amp; Pine — three attached files. Useful for a shorter walkthrough.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => go("/api/tasks/sample", "sample")}
              disabled={busy !== null}
            >
              {busy === "sample" ? "Preparing the assignment…" : "Assign Harbor & Pine"}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
