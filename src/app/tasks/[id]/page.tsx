import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovalActions } from "@/components/approval-actions";
import { ExperienceBar } from "@/components/marks";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { downloadLabel } from "@/lib/content-type";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReviewActions } from "@/components/review-actions";
import { TaskLive } from "@/components/task-live";
import { PRODUCT_ALPHA_LABEL, PRODUCT_SUCCESS } from "@aether/contracts";
import { humanEffortLabel, suggestedFixTarget, workerDisplayName, workerRunningMessage } from "@aether/runtime";
import { ControlSurfaceNotice } from "@/components/control-surface-notice";
import { loadDeskTask } from "@/lib/desk-data";
import { taskProof, taskProofLine, trailMark, trailReason } from "@/lib/task-proof";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const desk = await loadDeskTask(id);
  if (desk.kind === "missing-host") {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-10">
        <ControlSurfaceNotice />
      </div>
    );
  }
  if (desk.kind === "missing-task") notFound();
  const { task, audit, approvals, sources, worker, manifest, grantReview, previews } = desk;
  const proof = taskProof(task, audit);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-10">
      <ExperienceBar current="trail" taskId={id} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Build an agent
          </Link>
          <h1 className="mt-3 text-3xl sm:text-4xl">
            {task.company ?? workerDisplayName(task.brief.workerKind)}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{task.brief.goal}</p>
          <p className="mt-2 text-xs text-muted-foreground">{PRODUCT_ALPHA_LABEL}.</p>
        </div>
        <Badge variant="secondary" className="w-fit capitalize">
          {task.status.replaceAll("_", " ")}
        </Badge>
      </div>

      <Card className="bg-foreground text-primary-foreground ring-white/12">
        <CardHeader>
          <CardTitle className="text-primary-foreground">This run — look for DENY</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="font-heading text-xl font-medium">{taskProofLine(proof)}</p>
          <p className="text-primary-foreground/70">
            {PRODUCT_SUCCESS}. The environment should be torn down when the run
            finishes. Outputs and the audit stay.
          </p>
          <div className="flex flex-wrap gap-2">
            {proof.allowTools.map((tool) => (
              <Badge key={`allow-${tool}`} variant="allow" className="h-6">
                ALLOW {tool}
              </Badge>
            ))}
            {proof.denyTools.map((tool) => (
              <Badge key={`deny-${tool}`} variant="deny" className="h-6">
                DENY {tool}
              </Badge>
            ))}
            {proof.approvalTools.map((tool) => (
              <Badge
                key={`approval-${tool}`}
                variant="outline"
                className="h-6 border-primary-foreground/20 text-primary-foreground"
              >
                REQUIRE_APPROVAL {tool}
              </Badge>
            ))}
            <Badge variant="outline" className="h-6 border-primary-foreground/20 text-primary-foreground">
              {proof.tornDown ? "environment torn down" : "environment still up"}
            </Badge>
            {task.identity ? (
              <Badge variant="outline" className="h-6 border-primary-foreground/20 text-primary-foreground">
                {proof.identityExpired ? "identity expired" : "identity active"}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This agent</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Worker</span>
            <br />
            <span className="font-mono">{worker?.id ?? task.brief.workerId ?? "—"}</span>
            {worker ? (
              <span className="ml-2 text-muted-foreground">
                {worker.name} · {worker.taskIds.length} task{worker.taskIds.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
          <p>
            <span className="text-muted-foreground">Task</span>
            <br />
            <span className="font-mono">{task.brief.id}</span>
          </p>
          <p>
            <span className="text-muted-foreground">CapabilityManifest</span>
            <br />
            <span className="font-mono">{manifest?.id ?? task.brief.capabilityManifestId ?? "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">WorkerEnvironment</span>
            <br />
            <span className="font-mono">{task.environment?.id ?? "composed at run"}</span>
          </p>
        </CardContent>
      </Card>

      <TaskLive
        taskId={id}
        status={task.status}
        runningMessage={workerRunningMessage(task.brief.workerKind)}
      />

      {task.status === "blocked_on_approval" ? (
        <p className="rounded-xl border border-border/70 bg-secondary/60 px-4 py-3 text-sm">
          The control plane held a sensitive action. Approve or deny it below. The
          agent cannot authorize payment itself.
        </p>
      ) : null}

      {task.summary ? (
        <p className="max-w-3xl text-lg">{task.summary}</p>
      ) : null}

      {!task.quality && task.status === "awaiting_review" ? (
        <Card>
          <CardHeader>
            <CardTitle>Operator decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {humanEffortLabel(task)}. Accept to expire this worker identity. Outputs
              and the audit stay.
            </p>
            <ReviewActions taskId={task.brief.id} suggestedTarget={suggestedFixTarget(task)} sendable />
          </CardContent>
        </Card>
      ) : null}

      {task.quality ? (
        <Card>
          <CardHeader>
            <CardTitle>Delivery score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-lg">
              {task.quality.sendableAfterOneReview
                ? "Yes — a user could send this after one review."
                : "Not yet — leftover defects would need another pass."}
            </p>
            <p className="text-muted-foreground">
              Score {Math.round((task.quality.deliveryScore ?? 0) * 100)} / 100
              {" · "}
              {humanEffortLabel(task)}
              {task.quality.pass ? ` · ${task.quality.pass} pack` : ""}
              {task.qualityDraft
                ? ` · first check had ${task.qualityDraft.issues.length} issues, now ${task.quality.issues.length}`
                : ""}
            </p>
            {task.openedFiles && task.openedFiles.length > 0 ? (
              <p>
                Opened on the workstation:{" "}
                <span className="font-mono text-xs">
                  {task.openedFiles.map((path) => path.split("/").pop()).join(" · ")}
                </span>
              </p>
            ) : null}
            {task.quality.issues.length > 0 ? (
              <ul className="list-disc pl-5 text-muted-foreground">
                {task.quality.issues.slice(0, 6).map((issue) => (
                  <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                Names, numbers, and conclusions match across the spreadsheet and slides.
              </p>
            )}
            {task.review ? (
              <p className="text-muted-foreground">
                Human interventions: {task.review.interventions}
                {task.review.fixRequests ? ` · fix passes: ${task.review.fixRequests}` : ""}
                {task.review.status !== "pending" ? ` · ${task.review.status}` : ""}
              </p>
            ) : null}
            {task.status === "awaiting_review" || task.status === "completed" ? (
              <ReviewActions
                taskId={task.brief.id}
                suggestedTarget={suggestedFixTarget(task)}
                sendable={
                  task.quality.sendableAfterOneReview === true && task.quality.issues.length === 0
                }
              />
            ) : task.review?.history.length ? (
              <ol className="space-y-1 text-muted-foreground">
                {task.review.history.map((event) => (
                  <li key={`${event.at}-${event.action}`}>
                    {event.action.replaceAll("_", " ")}
                    {event.label ? ` — ${event.label}` : ""}
                  </li>
                ))}
              </ol>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {task.identity ? (
        <Card>
          <CardHeader>
            <CardTitle>What this job may do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Worker identity</span>
                <br />
                <span className="font-mono">{task.identity.id}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Status</span>
                <br />
                <Badge variant="secondary" className="capitalize">
                  {task.identity.status}
                </Badge>
                <span className="ml-2 text-muted-foreground">
                  {task.identity.status === "expired"
                    ? "Expired when the assignment was accepted or rejected. Outputs and the audit remain."
                    : `Expires ${new Date(task.identity.expiresAt).toLocaleString()}`}
                </span>
              </p>
            </div>
            <div>
              <p className="font-medium">Allowed for this assignment</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {task.identity.granted.join(" · ")}
              </p>
            </div>
            <div>
              <p className="font-medium">Denied unless separately granted</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {task.identity.denied.join(" · ")}
              </p>
            </div>
            <div>
              <p className="font-medium">Needs your approval</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {task.identity.requireApproval.join(" · ")}
              </p>
            </div>
            {task.governance ? (
              <div className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-3">
                <p>Authorized actions: {task.governance.authorizedActions}</p>
                <p>
                  Denied actions:{" "}
                  <span className={task.governance.deniedActions > 0 ? "text-destructive" : undefined}>
                    {task.governance.deniedActions}
                  </span>
                </p>
                <p>Approval requests: {task.governance.approvalRequests}</p>
                <p>Capabilities requested: {task.governance.capabilitiesRequested.length}</p>
                <p>Capabilities granted: {task.governance.capabilitiesGranted}</p>
                <p>Cross-task attempts: {task.governance.crossTaskAccessAttempts}</p>
              </div>
            ) : null}
            {task.environment ? (
              <div className="rounded-2xl bg-muted/40 p-3 ring-1 ring-foreground/8">
                <p className="font-medium">WorkerEnvironment</p>
                <p className="mt-1 font-mono text-xs">{task.environment.id}</p>
                <p className="mt-1 text-muted-foreground">
                  {task.environment.status === "destroyed"
                    ? "torn down when the run finished"
                    : "still running"}
                  . Outputs and the audit stayed on this desk.
                </p>
              </div>
            ) : task.isolation ? (
              <div className="rounded-2xl bg-muted/40 p-3 ring-1 ring-foreground/8">
                <p className="font-medium">Task environment</p>
                <p className="mt-1 text-muted-foreground">
                  {task.isolation.status === "destroyed"
                    ? "torn down when the run finished"
                    : "still running"}
                  . Outputs and the audit stayed on this desk.
                </p>
              </div>
            ) : null}
            <p className="text-muted-foreground">
              The agent asked for tools. The control plane decided. A substrate adapter
              only ran what was allowed, inside this WorkerEnvironment. That is the
              product — not a prompt asking the model to behave. {PRODUCT_ALPHA_LABEL}.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(task.plan?.steps ?? []).map((step, index) => (
                <li key={step.id} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {step.title}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {step.status.replaceAll("_", " ")}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card id="artifacts">
          <CardHeader>
            <CardTitle>Deliverables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.artifacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No artifacts yet. If the task failed, check the audit trail.
              </p>
            ) : (
              task.artifacts.map((artifact) => (
                <div key={artifact.relativePath} className="space-y-2 rounded-lg border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{artifact.title ?? artifact.name}</p>
                    <Badge variant="outline" className="capitalize">
                      {artifact.kind}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {artifact.validated ? "Validated" : "Not validated"} · {artifact.name}
                  </p>
                  <a
                    className={cn(buttonVariants(), "inline-flex")}
                    href={`/api/tasks/${task.brief.id}/artifacts/${artifact.name}`}
                  >
                    {downloadLabel(artifact.kind)}
                  </a>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {sources.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Source originals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <a
                key={source.name}
                className="rounded-lg border border-border/70 px-3 py-1.5 text-sm hover:bg-accent"
                href={`/api/tasks/${task.brief.id}/sources/${source.name}`}
              >
                {source.name}
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {task.evaluation ? (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>Task success: {task.evaluation.taskSuccess ? "yes" : "not yet"}</p>
            <p>Self-review cycles: {task.evaluation.selfReviewCycles}</p>
            <p>Citation coverage: {Math.round(task.evaluation.citationCoverage * 100)}%</p>
            <p>Company recall: {Math.round(task.evaluation.factualAccuracy * 100)}%</p>
            <p>User interventions: {task.evaluation.userInterventions}</p>
            <p>Human effort: {humanEffortLabel(task)}</p>
            <p>Runtime: {Math.round(task.evaluation.runtimeMs / 1000)}s</p>
            {typeof task.evaluation.deliveryScore === "number" ? (
              <p>Delivery score: {Math.round(task.evaluation.deliveryScore * 100)} / 100</p>
            ) : null}
            {typeof task.evaluation.sendableAfterOneReview === "boolean" ? (
              <p>Sendable after one review: {task.evaluation.sendableAfterOneReview ? "yes" : "not yet"}</p>
            ) : null}
            {typeof task.evaluation.leftoverGaps === "number" ? (
              <p>Leftover gaps: {task.evaluation.leftoverGaps}</p>
            ) : null}
            <p>Cross-artifact consistency: {Math.round(task.evaluation.crossArtifactConsistency * 100)}%</p>
            {typeof task.evaluation.deniedActions === "number" ? (
              <>
                <p>Authorized actions: {task.evaluation.authorizedActions ?? "—"}</p>
                <p>Denied actions: {task.evaluation.deniedActions}</p>
              </>
            ) : null}
            {task.evaluation.notes.length > 0 ? (
              <ul className="sm:col-span-2 list-disc pl-5 text-muted-foreground">
                {task.evaluation.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(task.companies?.length ?? 0) >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Company comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Funding</TableHead>
                  <TableHead>Missing / conflicts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.companies!.map((company) => (
                  <TableRow key={company.name}>
                    <TableCell>{company.name}</TableCell>
                    <TableCell>{company.businessModel ?? "—"}</TableCell>
                    <TableCell>{company.funding ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[
                        ...company.missing,
                        ...company.conflicts.map((item) => `${item.field} conflict`),
                      ].join(", ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {previews.slides?.slides.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Presentation preview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {previews.slides.slides.map((slide, index) => (
              <div
                key={`${slide.title}-${index}`}
                className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
              >
                <p className="font-mono text-xs text-muted-foreground">
                  Slide {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-1 font-medium">{slide.title}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {slide.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {previews.markdown ? (
        <Card>
          <CardHeader>
            <CardTitle>Written summary</CardTitle>
          </CardHeader>
          <CardContent>
            <article className="max-w-none space-y-3 text-sm leading-6 whitespace-pre-wrap">
              {previews.markdown}
            </article>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
        </CardHeader>
        <CardContent>
          {task.findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No structured findings recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Citation</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Uncertainty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.findings.map((finding, index) => (
                  <TableRow key={`${finding.finding}-${index}`}>
                    <TableCell className="whitespace-nowrap">{finding.category}</TableCell>
                    <TableCell>{finding.finding}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {finding.citationId ?? finding.source}
                    </TableCell>
                    <TableCell className="capitalize">{finding.confidence}</TableCell>
                    <TableCell>
                      {finding.uncertain ? (
                        <span className="text-destructive">
                          Flagged{finding.uncertaintyNote ? ` — ${finding.uncertaintyNote}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(task.citations?.length ?? 0) > 0 || (task.uncertainties?.length ?? 0) > 0 || task.researchNotes ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sources cited</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(task.citations ?? []).map((citation) => (
                <div key={citation.id}>
                  <p className="font-medium">
                    [{citation.id}] {citation.source}
                  </p>
                  {citation.excerpt ? (
                    <p className="text-muted-foreground">{citation.excerpt}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Uncertainty and limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {task.researchNotes ? (
                <p className="text-muted-foreground">
                  Method: {task.researchNotes.method.replaceAll("-", " ")}.
                </p>
              ) : null}
              {(task.uncertainties ?? []).map((flag) => (
                <p key={flag.id}>
                  <span className="font-medium capitalize">{flag.reason}:</span> {flag.note}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {approvals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvals.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {ticket.request.tool} · {ticket.status}
                  </p>
                  <p className="text-sm text-muted-foreground">{ticket.reason}</p>
                </div>
                {ticket.status === "pending" ? (
                  <ApprovalActions taskId={task.brief.id} approvalId={ticket.id} />
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card id="trail">
        <CardHeader>
          <CardTitle>Activity log — DENY is the product working</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {grantReview ? (
            <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm ring-1 ring-foreground/8">
              <p className="font-medium">Grant selected · Task-scoped. Not a standing ALLOW.</p>
              <p className="mt-1 text-muted-foreground">
                {grantReview.grantor} · {new Date(grantReview.at).toLocaleString()}
                {grantReview.capabilitiesAdded.length > 0
                  ? ` · ${grantReview.capabilitiesAdded.join(", ")}`
                  : " · no capabilities added"}
              </p>
              {grantReview.leftoverDenials.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {grantReview.leftoverDenials.map((row) => (
                    <li key={row.name}>
                      DENY <span className="font-mono">{row.name}</span> — {row.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet. After a run, DENY lines and torn down show here.
            </p>
          ) : (
            <ol className="space-y-2 text-sm">
              {audit.map((event) => {
                const mark = trailMark(event);
                const reason = trailReason(event);
                const denied = mark === "DENY";
                const torn = mark === "torn down";
                const approval = mark === "REQUIRE_APPROVAL";
                return (
                  <li
                    key={event.id}
                    className={cn(
                      "grid gap-1 rounded-xl px-3 py-2.5 ring-1 ring-foreground/8 sm:grid-cols-[auto_1fr_auto] sm:items-start sm:gap-4",
                      denied && "bg-deny-foreground/80",
                      torn && "bg-muted/70",
                      approval && "bg-muted/50",
                    )}
                  >
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span>
                      <span className="text-foreground">
                        {event.tool ?? event.action.replaceAll(".", " ")}
                      </span>
                      {reason ? (
                        <span
                          className={cn(
                            "mt-1 block text-xs leading-5",
                            denied ? "text-deny" : "text-muted-foreground",
                          )}
                        >
                          {reason}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        denied ? "text-deny" : mark === "ALLOW" ? "text-allow" : "text-muted-foreground",
                      )}
                    >
                      {mark}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
