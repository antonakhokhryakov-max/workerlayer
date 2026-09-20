/** Soft product marks. Simple SVG — not enterprise chrome, not a third-party logo. */

/** FROM a fragmented stack → TO a WorkerEnvironment. Geometric, no type in the SVG. */
export function FromToGraphic({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 560 220"
      role="img"
      aria-label="From a fragmented stack to a WorkerEnvironment"
    >
      <rect x="8" y="18" width="236" height="184" rx="28" fill="#ffffff" stroke="rgb(24 25 27 / 0.08)" />
      <rect x="28" y="48" width="88" height="18" rx="9" fill="#ececee" />
      <rect x="124" y="48" width="64" height="18" rx="9" fill="#ececee" />
      <rect x="28" y="78" width="72" height="18" rx="9" fill="#e4e5e8" />
      <rect x="108" y="78" width="52" height="18" rx="9" fill="#ececee" />
      <rect x="168" y="78" width="40" height="18" rx="9" fill="#e4e5e8" />
      <rect x="28" y="108" width="60" height="18" rx="9" fill="#ececee" />
      <rect x="96" y="108" width="84" height="18" rx="9" fill="#e4e5e8" />
      <rect x="28" y="138" width="96" height="18" rx="9" fill="#ececee" />
      <rect x="132" y="138" width="48" height="18" rx="9" fill="#e4e5e8" />
      <rect x="28" y="168" width="56" height="18" rx="9" fill="#ececee" />

      <path d="M258 110 H300" stroke="#18191b" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M292 103 L304 110 L292 117" fill="none" stroke="#18191b" strokeWidth="1.6" strokeLinecap="round" />

      <rect x="316" y="18" width="236" height="184" rx="28" fill="#18191b" />
      <rect x="330" y="32" width="208" height="156" rx="20" fill="#fcfcfc" />
      <rect x="350" y="62" width="112" height="20" rx="10" fill="#18191b" />
      <rect x="470" y="62" width="48" height="20" rx="10" fill="#ececee" />
      <rect x="350" y="96" width="56" height="20" rx="10" fill="#18191b" />
      <rect x="414" y="96" width="52" height="20" rx="10" fill="#18191b" />
      <rect x="474" y="96" width="44" height="20" rx="10" fill="#ececee" />
      <rect x="350" y="130" width="72" height="20" rx="10" fill="#18191b" />
      <rect x="430" y="130" width="88" height="20" rx="10" fill="#3f6b4b" />
    </svg>
  );
}

export function WorkerGlyph({
  kind = "echo",
  className,
}: {
  kind?: "echo" | "staff" | "claims" | "desk";
  className?: string;
}) {
  const fills =
    kind === "echo"
      ? ["#18191b", "#d7d8db", "#3f6b4b"]
      : kind === "staff"
        ? ["#d7d8db", "#18191b", "#f4f4f5"]
        : kind === "claims"
          ? ["#f4f4f5", "#b42318", "#d7d8db"]
          : ["#f4f4f5", "#18191b", "#d7d8db"];
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#fcfcfc" stroke="rgb(24 25 27 / 0.08)" />
      <circle cx="16" cy="20" r="6" fill={fills[0]} />
      <rect x="26" y="14" width="14" height="10" rx="3" fill={fills[1]} />
      <rect x="10" y="30" width="28" height="8" rx="4" fill={fills[2]} />
    </svg>
  );
}

export function ExperienceBar({
  current,
  taskId,
  className,
}: {
  current?: "assign" | "job" | "sketch" | "grant" | "trail" | "artifacts";
  taskId?: string;
  className?: string;
}) {
  const trailHref = taskId ? `/tasks/${taskId}#trail` : "/#trail";
  const artifactsHref = taskId ? `/tasks/${taskId}#artifacts` : "/#trail";
  const steps = [
    { id: "assign" as const, label: "Worker", href: "/#assign" },
    { id: "job" as const, label: "Goal", href: "/#job" },
    { id: "sketch" as const, label: "Sketch", href: "/#sketch-grant" },
    { id: "grant" as const, label: "Grant selected", href: "/#sketch-grant" },
    { id: "trail" as const, label: "Trail / DENY proof", href: trailHref },
    { id: "artifacts" as const, label: "Artifacts", href: artifactsHref },
  ];
  return (
    <nav className={className} aria-label="Build an agent">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {steps.map((step, index) => {
          const active = current === step.id;
          return (
            <li key={step.id} className="flex items-center gap-2">
              {index > 0 ? <span className="text-muted-foreground/50">→</span> : null}
              <a
                href={step.href}
                className={
                  active
                    ? "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-full px-3 py-1 text-xs text-muted-foreground ring-1 ring-foreground/8 hover:text-foreground"
                }
              >
                {step.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function BuildSteps({ className }: { className?: string }) {
  const steps = [
    { n: "1", title: "Spin up a Worker", detail: "Identity only. No tools, no Manifest, no standing ALLOW, no compute yet." },
    { n: "2", title: "Tell it the job", detail: "A Task with a goal. Environment starts only once the job exists." },
    { n: "3", title: "Grant selected tools", detail: "Sketch first. You choose. Untouched rows stay DENY-able." },
  ];
  return (
    <ol className={className}>
      {steps.map((step) => (
        <li key={step.n} className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-primary-foreground">
            {step.n}
          </span>
          <span>
            <span className="block text-sm font-medium">{step.title}</span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function EmptyTasksMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 88" aria-hidden="true">
      <rect x="8" y="10" width="204" height="68" rx="16" fill="#ffffff" stroke="rgb(24 25 27 / 0.08)" strokeDasharray="4 4" />
      <rect x="24" y="28" width="72" height="10" rx="5" fill="#f4f4f5" />
      <rect x="24" y="46" width="48" height="8" rx="4" fill="#eef6f0" />
      <rect x="80" y="46" width="52" height="8" rx="4" fill="#fdf2f1" />
      <text x="148" y="52" fontSize="10" fill="#5c5f66" fontFamily="ui-sans-serif, system-ui, sans-serif">
        DENY
      </text>
    </svg>
  );
}

export function JobGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#fcfcfc" stroke="rgb(24 25 27 / 0.08)" />
      <rect x="10" y="12" width="28" height="6" rx="3" fill="#18191b" />
      <rect x="10" y="22" width="22" height="6" rx="3" fill="#d7d8db" />
      <rect x="10" y="32" width="16" height="6" rx="3" fill="#ececee" />
    </svg>
  );
}

/** Soft Agent → Job → Tools. Geometric, no type in the SVG. */
export function AgentJobToolsGraphic({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 560 200"
      role="img"
      aria-label="Agent, then job, then tools"
    >
      <rect x="8" y="22" width="152" height="156" rx="28" fill="#ffffff" stroke="rgb(24 25 27 / 0.08)" />
      <circle cx="84" cy="78" r="22" fill="#18191b" />
      <rect x="48" y="118" width="72" height="36" rx="18" fill="#18191b" />

      <path d="M172 100 H204" stroke="#18191b" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M196 93 L208 100 L196 107" fill="none" stroke="#18191b" strokeWidth="1.6" strokeLinecap="round" />

      <rect x="216" y="22" width="152" height="156" rx="28" fill="#ffffff" stroke="rgb(24 25 27 / 0.08)" />
      <rect x="236" y="58" width="112" height="14" rx="7" fill="#18191b" />
      <rect x="236" y="84" width="88" height="14" rx="7" fill="#d7d8db" />
      <rect x="236" y="110" width="72" height="14" rx="7" fill="#ececee" />
      <rect x="236" y="136" width="96" height="14" rx="7" fill="#ececee" />

      <path d="M380 100 H412" stroke="#18191b" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M404 93 L416 100 L404 107" fill="none" stroke="#18191b" strokeWidth="1.6" strokeLinecap="round" />

      <rect x="424" y="22" width="128" height="156" rx="28" fill="#18191b" />
      <rect x="444" y="54" width="88" height="14" rx="7" fill="#fcfcfc" stroke="rgb(252 252 252 / 0.35)" strokeDasharray="3 3" />
      <rect x="444" y="80" width="88" height="14" rx="7" fill="#fcfcfc" />
      <rect x="444" y="106" width="64" height="14" rx="7" fill="#fcfcfc" stroke="rgb(252 252 252 / 0.35)" strokeDasharray="3 3" />
      <rect x="444" y="140" width="88" height="14" rx="7" fill="#3f6b4b" />
    </svg>
  );
}

export function SketchGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#fcfcfc" stroke="rgb(24 25 27 / 0.08)" />
      <rect x="10" y="12" width="28" height="7" rx="3.5" fill="#f4f4f5" stroke="rgb(24 25 27 / 0.12)" strokeDasharray="2 2" />
      <rect x="10" y="22" width="28" height="7" rx="3.5" fill="#18191b" />
      <rect x="10" y="32" width="20" height="7" rx="3.5" fill="#f4f4f5" stroke="rgb(24 25 27 / 0.12)" strokeDasharray="2 2" />
    </svg>
  );
}
