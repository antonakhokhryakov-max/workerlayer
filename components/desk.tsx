"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DeskInfo } from "@/lib/desk";

type DeskProps = {
  initialDesk: DeskInfo;
};

type HostPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  workers?: unknown;
  tasks?: unknown;
  manifest?: unknown;
  [key: string]: unknown;
};

function asList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["items", "workers", "tasks", "data", "entries"]) {
      if (Array.isArray(record[key])) {
        return asList(record[key]);
      }
    }
  }
  return [];
}

function labelOf(item: Record<string, unknown>, fallback: string) {
  for (const key of ["goal", "title", "name", "summary", "id", "path"]) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function hostFailureNote(entry: { response: Response; payload: HostPayload | null; text: string }): string | null {
  if (entry.response.ok) return null;
  const message = entry.payload?.message || entry.payload?.error;
  if (typeof message === "string" && message.trim() && !/^\s*</.test(message) && message.length < 280) {
    return message;
  }
  return `Host request failed (${entry.response.status})`;
}

function statusOf(item: Record<string, unknown>) {
  for (const key of ["status", "state", "phase"]) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "host";
}

export function Desk({ initialDesk }: DeskProps) {
  const [desk, setDesk] = useState<DeskInfo>(initialDesk);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Record<string, unknown>[]>([]);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [manifest, setManifest] = useState<string>("");
  const [hostNote, setHostNote] = useState<string>("Waiting on host.");
  const [busy, setBusy] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInput, setTaskInput] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);

  const loadDesk = useCallback(async () => {
    const response = await fetch("/api/desk", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Desk metadata failed (${response.status})`);
    }
    setDesk((await response.json()) as DeskInfo);
  }, []);

  const readHost = useCallback(async (path: string) => {
    const response = await fetch(path, { cache: "no-store" });
    const text = await response.text();
    let payload: HostPayload | null = null;
    try {
      payload = text ? (JSON.parse(text) as HostPayload) : null;
    } catch {
      payload = { message: text };
    }
    return { response, payload, text };
  }, []);

  const refreshHost = useCallback(async () => {
    const [workerRes, taskRes] = await Promise.all([
      readHost("/api/workers"),
      readHost("/api/tasks"),
    ]);

    const notes = [workerRes, taskRes]
      .map(hostFailureNote)
      .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

    if (notes.length > 0) {
      setHostNote(notes[0] ?? "Host did not return a payload.");
    } else {
      setHostNote("Host reachable. Compute stays on the mini.");
    }

    setWorkers(asList(workerRes.payload?.workers ?? workerRes.payload));
    setTasks(asList(taskRes.payload?.tasks ?? taskRes.payload));
    setManifest("Manifest is not exposed by the host API. This desk never executes it.");
  }, [readHost]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadDesk();
        if (!cancelled) await refreshHost();
      } catch (error) {
        if (!cancelled) {
          setDeskError(error instanceof Error ? error.message : "Desk failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDesk, refreshHost]);

  const hostTone = useMemo(() => {
    return desk.host.configured ? "ok" : "bad";
  }, [desk]);

  async function postToHost(path: string, body: unknown, label: string) {
    setBusy(label);
    setLastAction(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      setLastAction(`${label}: ${response.status} ${text.slice(0, 280)}`);
      await refreshHost();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-7">
      <header className="flex flex-col gap-4 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-brass uppercase">
            Alpha desk · control surface
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">WorkerLayer</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Vercel imports this repo as the desk only. Tasks stay on the Mac mini host
            via <span className="font-mono text-ink">WORKERLAYER_HOST_URL</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-normal uppercase">
          <Chip tone={hostTone}>{desk.host.configured ? "Host configured" : "Host unset"}</Chip>
          <Chip>Stage 2</Chip>
          <Chip>Grant selected</Chip>
          <Chip>No SSO</Chip>
        </div>
      </header>

      {deskError ? (
        <p className="mt-4 border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{deskError}</p>
      ) : null}

      <main className="mt-5 grid flex-1 gap-4 lg:grid-cols-12">
        <section className="border border-rule bg-paper-2 p-4 lg:col-span-3">
          <SectionLabel>Grant</SectionLabel>
          <dl className="mt-3 space-y-3 text-sm">
            <Row label="Status" value={desk.grant.selected ? "Selected" : "—"} />
            <Row label="Grant" value={desk.grant.id} mono />
            <Row label="Key" value={desk.key.masked ?? "not set"} mono />
            <Row label="Key kind" value="Identity only" />
            <Row label="SSO" value="Not used" />
            <Row label="Compute" value="Mac mini host (fixed)" />
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">
            Stage 2 has no grant picker, no SSO, and no compute picker. The identity
            key identifies this desk. It does not authorize Vercel to run compute.
          </p>
        </section>

        <section className="border border-rule bg-paper-2 p-4 lg:col-span-6">
          <SectionLabel>Tasks</SectionLabel>
          <p className="mt-2 text-xs text-muted">{hostNote}</p>

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void postToHost(
                "/api/startTask",
                {
                  title: taskTitle,
                  input: taskInput,
                  goal: [taskTitle, taskInput].filter((value) => value.trim()).join("\n\n"),
                },
                "startTask",
              );
            }}
          >
            <label className="block">
              <span className="font-mono text-[11px] tracking-wide text-muted uppercase">Title</span>
              <input
                className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-brass"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Task title"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] tracking-wide text-muted uppercase">Input</span>
              <textarea
                className="mt-1 min-h-24 w-full border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-brass"
                value={taskInput}
                onChange={(event) => setTaskInput(event.target.value)}
                placeholder="Forwarded to the mini. This desk does not execute it."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy !== null}
                className="bg-ink px-3 py-2 text-sm text-paper hover:bg-brass disabled:opacity-50"
              >
                {busy === "startTask" ? "Sending to host…" : "Send startTask to host"}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void refreshHost()}
                className="border border-rule px-3 py-2 text-sm hover:border-brass disabled:opacity-50"
              >
                Refresh from host
              </button>
            </div>
          </form>

          <HostList
            empty="No tasks returned by the host."
            items={tasks.map((task, index) => ({
              title: labelOf(task, `Task ${index + 1}`),
              status: statusOf(task),
            }))}
          />
        </section>

        <section className="border border-rule bg-paper-2 p-4 lg:col-span-3">
          <SectionLabel>Workers</SectionLabel>
          <p className="mt-2 text-xs text-muted">
            Worker processes are listed from the mini. This surface never starts a runtime.
          </p>
          <HostList
            empty="No workers returned by the host."
            items={workers.map((worker, index) => ({
              title: labelOf(worker, `Worker ${index + 1}`),
              status: statusOf(worker),
            }))}
          />
          <div className="mt-5">
            <SectionLabel>Manifest</SectionLabel>
            <pre className="mt-3 max-h-40 overflow-auto border border-rule bg-paper p-3 font-mono text-[11px] leading-4 whitespace-pre-wrap">
              {manifest || "—"}
            </pre>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void postToHost("/api/manifest/exec", { source: "desk" }, "manifest.exec")}
              className="mt-3 border border-rule px-3 py-2 text-sm hover:border-brass disabled:opacity-50"
            >
              {busy === "manifest.exec" ? "Asking host…" : "Ask host to exec Manifest"}
            </button>
          </div>
        </section>
      </main>

      {lastAction ? (
        <p className="mt-4 border border-rule bg-chip px-3 py-2 font-mono text-xs break-all">
          {lastAction}
        </p>
      ) : null}

      <footer className="mt-6 flex flex-col gap-1 border-t border-rule pt-4 font-mono text-[11px] text-muted sm:flex-row sm:justify-between">
        <span>
          Must not run on Vercel: {desk.vercelMustNotRun.join(" · ")}
        </span>
        <span>{desk.host.origin ?? "Set WORKERLAYER_HOST_URL on Vercel"}</span>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] tracking-[0.18em] text-brass uppercase">{children}</h2>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const tones = {
    ok: "border-ok/30 bg-ok/10 text-ok",
    warn: "border-warn/30 bg-warn/10 text-warn",
    bad: "border-bad/30 bg-bad/10 text-bad",
    neutral: "border-rule bg-chip text-ink",
  };
  return (
    <span className={`whitespace-nowrap border px-2 py-1 tracking-normal ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "text-right"}>{value}</dd>
    </div>
  );
}

function HostList({
  items,
  empty,
}: {
  items: { title: string; status: string }[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-muted">{empty}</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-rule border border-rule">
      {items.map((item) => (
        <li key={`${item.title}-${item.status}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span>{item.title}</span>
          <span className="font-mono text-[11px] text-muted uppercase">{item.status}</span>
        </li>
      ))}
    </ul>
  );
}
