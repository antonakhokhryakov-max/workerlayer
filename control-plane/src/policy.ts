import type {
  ActionRequest,
  PolicyDecision,
  RegisteredTool,
  TaskCapabilities,
} from "@aether/contracts";
import { ALLOWLIST_FETCH_CAPABILITY, capabilityForTool } from "./capabilities";

const POLICY_ID = "aether.knowledge-work.stage2.v1";

function deny(requestId: string, reason: string): PolicyDecision {
  return { requestId, decision: "deny", reason, policyId: POLICY_ID };
}

function allow(requestId: string, reason: string): PolicyDecision {
  return { requestId, decision: "allow", reason, policyId: POLICY_ID };
}

function approve(requestId: string, reason: string): PolicyDecision {
  return {
    requestId,
    decision: "require_approval",
    reason,
    policyId: POLICY_ID,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Relative workspace path, or null if the path is illegal. */
export function normalizeWorkspacePath(
  raw: unknown,
): { ok: true; path: string } | { ok: false; reason: string } {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "Path is required." };
  }
  const trimmed = raw.trim().replaceAll("\\", "/");
  if (trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed)) {
    return { ok: false, reason: "Absolute paths are not allowed." };
  }
  const parts = trimmed.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.some((part) => part === "..")) {
    return { ok: false, reason: "Path traversal is not allowed." };
  }
  return { ok: true, path: parts.join("/") };
}

function startsWithPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => {
    if (prefix.endsWith("/")) {
      return path === prefix.slice(0, -1) || path.startsWith(prefix);
    }
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

function destinationOf(request: ActionRequest): string | undefined {
  return (
    asString(request.args.destination) ??
    asString(request.args.url) ??
    asString(request.args.to)
  );
}

const FOREIGN_TASK = /tsk_[a-z0-9]+/i;

export function foreignTaskIdInPath(path: string, thisTaskId: string): string | undefined {
  const match = path.match(FOREIGN_TASK);
  if (match && match[0] !== thisTaskId) return match[0];
  return undefined;
}

/** Example restricted names. Not a finance product — any assignment can mark files this way. */
export function looksLikeRestrictedFile(path: string): boolean {
  return /(?:^|\/)(?:payroll|salary|compensation|ssn|restricted)(?:[-_.]|\.|$)/i.test(path);
}

export function evaluatePolicy(
  request: ActionRequest,
  capabilities: TaskCapabilities,
): PolicyDecision {
  const dest = destinationOf(request);
  const registered = capabilities.registeredTools?.find((item) => item.name === request.tool);
  if (registered) {
    return evaluateRegisteredTool(request, capabilities, registered);
  }

  const needed = capabilityForTool(request.tool, capabilities);
  if (
    needed &&
    capabilities.granted &&
    !capabilities.granted.includes(needed) &&
    request.tool !== "network.fetch"
  ) {
    if (
      dest &&
      capabilities.sensitiveDestinations.includes(dest) &&
      (request.tool === "export.send_external" || request.tool === "network.fetch")
    ) {
      return approve(
        request.id,
        `External action to '${dest}' is sensitive and needs operator approval.`,
      );
    }
    return deny(request.id, `Capability '${needed}' is not granted for this task.`);
  }

  switch (request.tool) {
    case "workspace.list_files":
      return allow(request.id, "Listing the task workspace is in-scope.");

    case "workspace.ingest_sources":
      return allow(request.id, "Ingesting attached task sources is allowed.");

    case "pdf.open":
    case "pdf.ocr":
    case "spreadsheet.open": {
      const path = normalizeWorkspacePath(request.args.path);
      if (!path.ok) return deny(request.id, path.reason);
      const otherTask = foreignTaskIdInPath(path.path, request.taskId);
      if (otherTask) {
        return deny(
          request.id,
          `Cross-task file access is not permitted. Worker for ${request.taskId} cannot read ${otherTask}.`,
        );
      }
      if (looksLikeRestrictedFile(path.path)) {
        return deny(
          request.id,
          `File '${path.path}' is restricted and is not in this assignment's capability set.`,
        );
      }
      const openable = [
        ...capabilities.allowedReadPrefixes,
        ...capabilities.allowedWritePrefixes,
      ];
      if (!startsWithPrefix(path.path, openable)) {
        return deny(request.id, `File '${path.path}' is outside this task environment.`);
      }
      return allow(
        request.id,
        request.tool === "pdf.open"
          ? "Opening an attached PDF in the task workstation is allowed."
          : request.tool === "pdf.ocr"
            ? "OCR of an attached image-only PDF in the task workstation is allowed."
            : "Opening a spreadsheet in the task workstation is allowed.",
      );
    }

    case "workspace.read_file":
    case "pdf.extract_text": {
      const path = normalizeWorkspacePath(request.args.path);
      if (!path.ok) return deny(request.id, path.reason);
      const otherTask = foreignTaskIdInPath(path.path, request.taskId);
      if (otherTask) {
        return deny(
          request.id,
          `Cross-task file access is not permitted. Worker for ${request.taskId} cannot read ${otherTask}.`,
        );
      }
      if (looksLikeRestrictedFile(path.path)) {
        return deny(
          request.id,
          `File '${path.path}' is restricted and is not in this assignment's capability set.`,
        );
      }
      if (!startsWithPrefix(path.path, capabilities.allowedReadPrefixes)) {
        return deny(
          request.id,
          `File '${path.path}' is outside allowed read locations.`,
        );
      }
      return allow(request.id, "Reading an attached source file is allowed.");
    }

    case "research.review_sources":
      return allow(
        request.id,
        "Reviewing attached materials (no open web) is allowed.",
      );

    case "analysis.record_findings":
      return allow(
        request.id,
        "Recording structured analysis inside the task is allowed.",
      );

    case "spreadsheet.create":
    case "spreadsheet.update":
    case "presentation.create":
    case "document.create": {
      const filename =
        asString(request.args.filename) ??
        (request.tool === "presentation.create"
          ? "briefing.pptx"
          : request.tool === "document.create"
            ? "summary.md"
            : "findings.xlsx");
      if (filename.startsWith("/") || /^[a-zA-Z]:/.test(filename)) {
        return deny(request.id, "Absolute paths are not allowed.");
      }
      const nested = filename.replace(/^artifacts\//, "");
      const path = normalizeWorkspacePath(`artifacts/${nested}`);
      if (!path.ok) return deny(request.id, path.reason);
      if (!startsWithPrefix(path.path, capabilities.allowedWritePrefixes)) {
        return deny(request.id, "Artifacts must be written to artifacts/.");
      }
      return allow(
        request.id,
        "Creating or updating a task artifact is allowed.",
      );
    }

    case "artifact.inspect":
    case "quality.check":
      return allow(
        request.id,
        "Inspecting and checking task outputs is allowed.",
      );

    case "artifact.validate": {
      const path = normalizeWorkspacePath(
        asString(request.args.path) ??
          `artifacts/${asString(request.args.filename) ?? ""}`,
      );
      if (!path.ok) return deny(request.id, path.reason);
      if (!startsWithPrefix(path.path, capabilities.allowedWritePrefixes)) {
        return deny(request.id, "Can only validate artifacts in this task.");
      }
      return allow(request.id, "Validating a task artifact is allowed.");
    }

    case "network.fetch": {
      const dest = destinationOf(request);
      if (!dest) {
        return deny(request.id, "An external destination is required.");
      }
      if (capabilities.sensitiveDestinations.includes(dest)) {
        return approve(
          request.id,
          `External action to '${dest}' is sensitive and needs operator approval.`,
        );
      }
      if (
        capabilities.networkAllowlist.includes(dest) &&
        capabilities.granted.includes(ALLOWLIST_FETCH_CAPABILITY)
      ) {
        return allow(
          request.id,
          `Destination '${dest}' is on this assignment's approved allowlist.`,
        );
      }
      return deny(
        request.id,
        `Destination '${dest}' is not authorized for this task.`,
      );
    }

    case "export.send_external": {
      const dest = destinationOf(request);
      if (!dest) {
        return deny(request.id, "An external destination is required.");
      }
      if (capabilities.sensitiveDestinations.includes(dest)) {
        return approve(
          request.id,
          `External action to '${dest}' is sensitive and needs operator approval.`,
        );
      }
      if (!capabilities.networkAllowlist.includes(dest)) {
        return deny(
          request.id,
          `Destination '${dest}' is not authorized for this task.`,
        );
      }
      if (!capabilities.canExport) {
        return approve(
          request.id,
          "Export is not pre-authorized; operator approval is required.",
        );
      }
      return allow(request.id, "Destination is on the task allowlist.");
    }

    case "claims.read":
      return allow(request.id, "Reading claims on this assignment is allowed.");

    case "claims.update":
      return allow(request.id, "Updating a claim on this assignment is allowed.");

    case "claims.pay":
      return approve(
        request.id,
        "Paying a claim is sensitive and needs operator approval.",
      );

    case "unrelated.data":
      return deny(
        request.id,
        "Capability 'unrelated:data' is not granted for this task.",
      );

    case "python.execute": {
      const source = asString(request.args.source);
      if (!source?.trim()) {
        return deny(request.id, "Sandbox python requires source text.");
      }
      if (source.length > 32_000) {
        return deny(request.id, "Sandbox source is larger than this assignment allows.");
      }
      return allow(
        request.id,
        "Declared sandbox execution is allowed inside this WorkerEnvironment.",
      );
    }

    default:
      return deny(request.id, "Unknown action is denied by default.");
  }
}

function evaluateRegisteredTool(
  request: ActionRequest,
  capabilities: TaskCapabilities,
  registered: RegisteredTool,
): PolicyDecision {
  const needed = registered.capability;
  if (registered.policy === "deny" || capabilities.denied.includes(needed)) {
    return deny(request.id, `Capability '${needed}' is not granted for this task.`);
  }
  if (!capabilities.granted.includes(needed)) {
    return deny(request.id, `Capability '${needed}' is not granted for this task.`);
  }
  const pathArg =
    asString(request.args.path) ?? asString(request.args.filename) ?? asString(request.args.name);
  if (pathArg) {
    const path = normalizeWorkspacePath(pathArg);
    if (!path.ok) return deny(request.id, path.reason);
    const otherTask = foreignTaskIdInPath(path.path, request.taskId);
    if (otherTask) {
      return deny(
        request.id,
        `Cross-task file access is not permitted. Worker for ${request.taskId} cannot read ${otherTask}.`,
      );
    }
    if (looksLikeRestrictedFile(path.path)) {
      return deny(
        request.id,
        `File '${path.path}' is restricted and is not in this assignment's capability set.`,
      );
    }
    const writing =
      asString(request.args.text) !== undefined || asString(request.args.content) !== undefined;
    if (writing) {
      const artifactPath = path.path.startsWith("artifacts/") ? path.path : `artifacts/${path.path}`;
      if (!startsWithPrefix(artifactPath, capabilities.allowedWritePrefixes)) {
        return deny(request.id, "Artifacts must be written to artifacts/.");
      }
    } else {
      const readable = [
        ...capabilities.allowedReadPrefixes,
        ...capabilities.allowedWritePrefixes,
      ];
      const candidate = startsWithPrefix(path.path, readable) ? path.path : `sources/${path.path}`;
      if (!startsWithPrefix(candidate, readable)) {
        return deny(request.id, `File '${path.path}' is outside this task environment.`);
      }
    }
  }
  if (
    registered.policy === "require_approval" ||
    capabilities.requireApproval.includes(needed)
  ) {
    return approve(
      request.id,
      `Action '${request.tool}' is sensitive and needs operator approval.`,
    );
  }
  return allow(request.id, `Declared tool '${request.tool}' is allowed on this assignment.`);
}
