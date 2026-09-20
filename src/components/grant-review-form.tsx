"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PRODUCT_ALPHA_LABEL,
  PRODUCT_GRANT_SELECTED,
  PRODUCT_LEFTOVER_DENY,
  PRODUCT_SKETCH_LABEL,
  PRODUCT_SKETCH_REVIEW,
  PRODUCT_SUCCESS,
} from "@aether/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_GOAL =
  "Read the attached slip and write a hold notice. Do not export it.";

interface SketchTool {
  name: string;
  capability: string;
  policy: "allow" | "deny" | "require_approval";
  reason: string;
}

interface SketchProposal {
  id?: string;
  hash?: string;
  goal: string;
  granted: boolean;
  status?: string;
  suggestedTools: SketchTool[];
  review?: string;
}

export function GrantReviewForm() {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [proposal, setProposal] = useState<SketchProposal | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"sketch" | "grant" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<{
    environmentId: string;
    taskId: string;
    selected: string[];
    leftovers: Array<{ name: string; reason: string }>;
  } | null>(null);

  async function sketch() {
    setError(null);
    setGranted(null);
    setBusy("sketch");
    try {
      const response = await fetch("/api/desk/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const json = (await response.json()) as { error?: string; proposal?: SketchProposal };
      if (!response.ok || !json.proposal) {
        throw new Error(json.error ?? "Could not sketch tools.");
      }
      setProposal(json.proposal);
      setSelected({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sketch tools.");
    } finally {
      setBusy(null);
    }
  }

  async function grantSelected() {
    if (!proposal) return;
    const tools = proposal.suggestedTools.filter((tool) => selected[tool.name]);
    setError(null);
    setBusy("grant");
    try {
      const response = await fetch("/api/desk/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worker: "desk-review",
          tools,
          confirm: true,
          proposal,
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        environment?: { id: string };
        task?: { id: string };
        grant?: { leftoverDenials?: Array<{ name: string; reason: string }>; selectedTools?: Array<{ name: string }> };
      };
      if (!response.ok || !json.environment || !json.task) {
        throw new Error(json.error ?? "Could not grant selected tools.");
      }
      setGranted({
        environmentId: json.environment.id,
        taskId: json.task.id,
        selected: json.grant?.selectedTools?.map((tool) => tool.name) ?? tools.map((tool) => tool.name),
        leftovers: json.grant?.leftoverDenials ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grant selected tools.");
    } finally {
      setBusy(null);
    }
  }

  const chosenCount = proposal
    ? proposal.suggestedTools.filter((tool) => selected[tool.name]).length
    : 0;
  const leftoverPreview = proposal
    ? proposal.suggestedTools.filter((tool) => !selected[tool.name])
    : [];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{PRODUCT_SKETCH_LABEL}</p>
      <p className="text-sm leading-6 text-muted-foreground">
        After the Worker and the job. {PRODUCT_SKETCH_REVIEW} Sketch only — suggested, not approved, not enabled, not a Manifest. Suggested ALLOW is not a grant. The API key is identity only — it never unlocks tools. Grant selected tools only. Untouched rows stay DENY-able. Environment starts on this Task, sticky, not a picker. {PRODUCT_ALPHA_LABEL}. {PRODUCT_SUCCESS}.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Textarea
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        rows={3}
        aria-label="Assignment text to sketch"
      />
      <Button type="button" variant="outline" onClick={() => void sketch()} disabled={busy !== null}>
                {busy === "sketch" ? "Sketching…" : "Sketch suggested tools"}
      </Button>
      {proposal ? (
        <div className="space-y-3 rounded-2xl bg-muted/40 p-4 ring-1 ring-foreground/8">
          <p className="text-xs text-muted-foreground">
            status: {proposal.status ?? "sketch"} · granted: {String(proposal.granted)} ·{" "}
            {PRODUCT_SKETCH_REVIEW}
          </p>
          {proposal.suggestedTools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggested tools. You still name tools yourself.</p>
          ) : (
            <ul className="space-y-2">
              {proposal.suggestedTools.map((tool) => (
                <li key={tool.name}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-background px-3 py-2.5 text-sm ring-1 ring-foreground/8">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-foreground"
                      checked={Boolean(selected[tool.name])}
                      onChange={(event) =>
                        setSelected((current) => ({ ...current, [tool.name]: event.target.checked }))
                      }
                    />
                    <span>
                      <span className="font-mono text-xs">{tool.name}</span>{" "}
                      <Badge variant="outline">
                        suggested{" "}
                        {tool.policy === "deny"
                          ? "DENY"
                          : tool.policy === "require_approval"
                            ? "REQUIRE_APPROVAL"
                            : "ALLOW"}
                      </Badge>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{tool.reason}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {leftoverPreview.length > 0 ? (
            <div className="space-y-1 text-xs leading-5 text-muted-foreground">
              <p>Denied leftovers if you Grant selected now:</p>
              {leftoverPreview.map((tool) => (
                <p key={`left-${tool.name}`}>
                  <span className="font-mono">{tool.name}</span> — {PRODUCT_LEFTOVER_DENY}
                </p>
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            size="lg"
            onClick={() => void grantSelected()}
            disabled={busy !== null || chosenCount === 0}
          >
            {busy === "grant" ? "Granting…" : PRODUCT_GRANT_SELECTED}
          </Button>
        </div>
      ) : null}
      {granted ? (
        <div className="space-y-2 rounded-2xl bg-background p-4 text-sm ring-1 ring-foreground/8">
          <p>
            Task-scoped Manifest on{" "}
            <span className="font-mono text-xs">{granted.taskId}</span>
            {" · "}
            selected {granted.selected.join(", ") || "none"}. Not a standing ALLOW.
          </p>
          {granted.leftovers.length > 0 ? (
            <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
              {granted.leftovers.map((row) => (
                <li key={row.name}>
                  <span className="font-mono">{row.name}</span> — {row.reason}
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            <Link
              href={`/tasks/${granted.taskId}#trail`}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              Open the Task trail — look for DENY
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
