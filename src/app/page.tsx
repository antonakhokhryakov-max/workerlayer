import Link from "next/link";
import {
  PRODUCT_ALPHA_LABEL,
  PRODUCT_ALPHA_SYNTHETIC,
  PRODUCT_MOTTO,
  PRODUCT_NAME,
  PRODUCT_STACK_FROM,
  PRODUCT_STACK_TO,
  PRODUCT_SUCCESS,
  PRODUCT_TAGLINE,
} from "@aether/contracts";
import { EFFORT_BOARD_NOTE, formatEffortLine } from "@aether/runtime";
import { EchoWorkerStart, JobAssign } from "@/components/assign-form";
import { GrantReviewForm } from "@/components/grant-review-form";
import {
  AgentJobToolsGraphic,
  BuildSteps,
  EmptyTasksMark,
  ExperienceBar,
  FromToGraphic,
  JobGlyph,
  SketchGlyph,
  WorkerGlyph,
} from "@/components/marks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ControlSurfaceNotice } from "@/components/control-surface-notice";
import { loadDeskHome } from "@/lib/desk-data";
import { PUBLIC_DESK_URL } from "@/lib/public-desk";
import { taskProof, taskProofLine } from "@/lib/task-proof";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const desk = await loadDeskHome();
  const missingHost = desk.kind === "missing-host";
  const workers = desk.kind === "host" ? desk.workers : [];
  const recent = desk.kind === "host" ? desk.recent : [];
  const effort = desk.kind === "host" ? desk.effort : [];
  const audits = desk.kind === "host" ? desk.audits : {};

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-12 lg:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">{PRODUCT_NAME}</p>
          <h1 className="mt-4 text-4xl leading-[1.1] sm:text-5xl">{PRODUCT_TAGLINE}.</h1>
          <p className="mt-5 text-xl text-foreground/80 sm:text-2xl">{PRODUCT_MOTTO}</p>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Build and run your agent here. Spin up a Worker, tell it the job, then
            Grant selected tools. You bring the model, the agent logic, the domain,
            and the UX. {PRODUCT_NAME} is the platform; Echo is the default second
            Worker, not the product.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {PRODUCT_ALPHA_LABEL}. {PRODUCT_ALPHA_SYNTHETIC}. {PRODUCT_SUCCESS}.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            This is the website. Open{" "}
            <a
              href={PUBLIC_DESK_URL}
              className="text-foreground underline underline-offset-4"
            >
              {PUBLIC_DESK_URL}
            </a>{" "}
            from a laptop — temporary Cloudflare tunnel for Alpha access, not a
            lasting Vercel site.
          </p>
        </div>
        <AgentJobToolsGraphic className="hidden w-full max-w-lg justify-self-end lg:block" />
      </section>

      <section className="mt-8 lg:hidden">
        <AgentJobToolsGraphic className="w-full" />
      </section>

      <div className="mt-14 space-y-4">
        <h2 className="font-heading text-2xl">Build and run your agent</h2>
        <ExperienceBar current="assign" />
        <p className="text-sm text-muted-foreground">
          Worker first, then the goal, then tools. Sketch is suggested only. Grant
          selected — look for DENY on the run trail. Artifacts land on the finished
          job.
        </p>
        {missingHost ? (
          <div className="pt-2">
            <ControlSurfaceNotice />
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Agent → Job → Tools</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Not an ops console. Echo is the default second Worker, not the
                product.
              </p>
            </CardHeader>
            <CardContent>
              <BuildSteps className="grid gap-4 sm:grid-cols-3" />
            </CardContent>
          </Card>

          <Card id="assign">
            <CardHeader className="flex flex-row items-start gap-3">
              <WorkerGlyph kind="echo" className="size-10 shrink-0" />
              <div>
                <CardTitle>1. Spin up a Worker</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Identity only. No tools, no Manifest, no standing ALLOW. No WorkerEnvironment yet — compute starts only when a Task exists, sticky per Task. You do not pick Docker or mounts.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {workers.length > 0 ? (
                <ul className="space-y-2">
                  {workers.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl px-3 py-2.5 text-sm ring-1 ring-foreground/8"
                    >
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Identity only. No standing ALLOW.
                        {item.taskIds.length === 0
                          ? " No Task yet — compute has not started."
                          : ` ${item.taskIds.length} job${item.taskIds.length === 1 ? "" : "s"}.`}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <EchoWorkerStart />
            </CardContent>
          </Card>

          <Card id="job">
            <CardHeader className="flex flex-row items-start gap-3">
              <JobGlyph className="size-10 shrink-0" />
              <div>
                <CardTitle>2. Tell it the job</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  A Task with a goal. Environment starts only once this job exists —
                  once per Task. You do not pick compute here.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <JobAssign />
            </CardContent>
          </Card>

          <Card id="sketch-grant">
            <CardHeader className="flex flex-row items-start gap-3">
              <SketchGlyph className="size-10 shrink-0" />
              <div>
                <CardTitle>3. Sketch / suggested tools</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  After the Worker and the job. A sketch is not a Manifest. You still
                  Grant selected tools. No compute picker.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <GrantReviewForm />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">When your agent runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6">
              <p>It reads files you attach to the job. Originals stay sealed.</p>
              <p>It can write the outputs this job granted — a hold notice, a sheet, a note.</p>
              <p>It may fetch only an exact destination this job listed.</p>
              <p className="text-muted-foreground">
                Sending data outside the job, opening the open web, or using a tool
                you did not grant is denied — and recorded. {PRODUCT_SUCCESS}. Open
                a run: DENY lines are marked, and torn down means the environment is
                gone.
              </p>
            </CardContent>
          </Card>

          <Card id="trail">
            <CardHeader>
              <CardTitle className="text-base">Trail — look for DENY</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="space-y-3">
                  <EmptyTasksMark className="w-full max-w-[220px]" />
                  <p className="text-sm text-muted-foreground">
                    No runs yet. Start with Echo — the default second Worker on
                    WorkerLayer, not an Echo product — or write a goal. Open a
                    finished run and look for DENY and torn down.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recent.map((task) => {
                    const proof = taskProof(task, audits[task.brief.id] ?? []);
                    return (
                    <li key={task.brief.id}>
                      <Link
                        href={`/tasks/${task.brief.id}`}
                        className="block rounded-xl px-3 py-2.5 ring-1 ring-foreground/8 transition-colors hover:bg-muted/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">
                            {task.company ?? task.brief.goal}
                          </p>
                          <Badge variant="secondary">{task.status.replaceAll("_", " ")}</Badge>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-foreground">
                          {taskProofLine(proof)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {proof.allowTools.slice(0, 3).map((tool) => (
                            <Badge key={`a-${task.brief.id}-${tool}`} variant="allow">
                              ALLOW {tool}
                            </Badge>
                          ))}
                          {proof.denyTools.slice(0, 2).map((tool) => (
                            <Badge key={`d-${task.brief.id}-${tool}`} variant="deny">
                              DENY {tool}
                            </Badge>
                          ))}
                          {proof.approvalTools.slice(0, 2).map((tool) => (
                            <Badge key={`r-${task.brief.id}-${tool}`} variant="outline">
                              REQUIRE_APPROVAL {tool}
                            </Badge>
                          ))}
                          {proof.tornDown ? (
                            <Badge variant="outline">torn down</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{formatEffortLine(task)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.brief.workerId ? `${task.brief.workerId} · ` : ""}
                          {task.brief.goal}
                        </p>
                      </Link>
                    </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {effort.length > 0 ? (
            <details className="rounded-2xl bg-card px-5 py-4 ring-1 ring-foreground/8">
              <summary className="cursor-pointer text-sm font-medium">Human effort (dogfood packs)</summary>
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Optimize for high delivery score and low cleanup. Compare Harbor,
                  Ironwharf diligence, the approved web note, the market pack, and
                  North Dock’s chief of staff here.
                </p>
                <p className="text-xs text-muted-foreground">{EFFORT_BOARD_NOTE}</p>
                {effort.map((row) => (
                  <div key={row.pack} className="rounded-xl bg-muted/50 px-3 py-2.5 ring-1 ring-foreground/8">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-1 text-muted-foreground">
                      Delivery{" "}
                      {typeof row.averageDeliveryScore === "number"
                        ? `${Math.round(row.averageDeliveryScore * 100)} / 100`
                        : "—"}
                      {" · "}
                      {row.acceptedZeroFix} accepted with 0 fixes
                      {" · "}
                      {row.acceptedWithFixes} accepted after a fix
                      {" · "}
                      {row.rejected} rejected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Avg interventions {row.averageInterventions}
                      {row.latestLabel ? ` · latest: ${row.latestLabel}` : ""}
                      {row.omitted > 0
                        ? ` · ${row.omitted} older leftover${row.omitted === 1 ? "" : "s"} not counted`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>

      <section className="mt-16 space-y-6">
        <FromToGraphic className="hidden w-full max-w-lg lg:block" />
        <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-muted/60 px-5 py-5 ring-1 ring-foreground/8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From</p>
          <p className="mt-1 font-heading text-lg">A fragmented stack</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Builders otherwise assemble this themselves before the worker can do
            real work.
          </p>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {PRODUCT_STACK_FROM.map((item) => (
              <li
                key={item}
                className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-foreground/8"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-foreground px-5 py-5 text-primary-foreground">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/60">To</p>
          <p className="mt-1 font-heading text-lg">A WorkerEnvironment</p>
          <p className="mt-2 text-sm text-primary-foreground/70">
            One focused surface. You keep the model and the agent. We keep
            governance.
          </p>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {PRODUCT_STACK_TO.map((item) => (
              <li
                key={item}
                className="rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        </div>
      </section>

      <section className="mt-10 grid gap-8 sm:grid-cols-3">
        {[
          {
            title: "Start a Worker",
            body: `Identity first. Then a job. Then Grant selected tools. ${PRODUCT_NAME} composes Worker → Task → CapabilityManifest → WorkerEnvironment. The 15-minute path is a keyed /api/v1 example, not Harbor fixtures.`,
          },
          {
            title: "You choose the tools",
            body: "A sketch is suggested only. Grant selected — the agent cannot grant itself access. Denied actions are written to the trail. ALLOW / ALLOW / DENY is the win.",
          },
          {
            title: "Run it",
            body: "One WorkerEnvironment for Echo, Harbor, Claims, and North Dock. Look for DENY on the finished run. Focus on your agent — not a second sandbox or lifecycle.",
          },
        ].map((item) => (
          <div key={item.title} className="space-y-2">
            <h2 className="font-heading text-lg">{item.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
