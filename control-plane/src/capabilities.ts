import type {
  ActionName,
  KnownActionName,
  RegisteredTool,
  TaskBrief,
  TaskCapabilities,
} from "@aether/contracts";

export const TOOL_CAPABILITY: Record<KnownActionName, string> = {
  "workspace.list_files": "files:read:task",
  "workspace.read_file": "files:read:task",
  "workspace.ingest_sources": "files:read:task",
  "pdf.extract_text": "files:read:task",
  "pdf.open": "pdf:open",
  "pdf.ocr": "pdf:ocr",
  "spreadsheet.open": "spreadsheet:open",
  "research.review_sources": "research:review:attached",
  "analysis.record_findings": "files:write:output",
  "spreadsheet.create": "spreadsheet:create",
  "spreadsheet.update": "spreadsheet:modify",
  "presentation.create": "presentation:create",
  "document.create": "document:create",
  "artifact.inspect": "artifact:inspect",
  "quality.check": "quality:check",
  "artifact.validate": "artifact:inspect",
  "export.send_external": "network:export",
  "network.fetch": "network:fetch",
  "python.execute": "code:execute:sandbox",
  "claims.read": "claims:read",
  "claims.update": "claims:update",
  "claims.pay": "claims:pay",
  "unrelated.data": "unrelated:data",
};

/**
 * Advertised Milestone 1 capability surface. Only what already runs end-to-end.
 * Harbor still grants extra first-party tools (PDF, quality, presentation) because
 * those already work — they are not a second product.
 */
export const M1_ADVERTISED_CAPABILITIES = [
  "files:read:task",
  "files:write:output",
  "code:execute:sandbox",
  "spreadsheet:create",
  "tool:invoke",
  "network:fetch:allowlist",
] as const;

/** Access this assignment does not receive. Policy still deny-by-default. */
export const DEFAULT_DENIED_CAPABILITIES = [
  "files:read:other-task",
  "files:read:restricted",
  "network:fetch",
  "network:upload",
];

/** Sensitive actions that need a human, even if the agent asks. */
export const DEFAULT_APPROVAL_CAPABILITIES = ["network:export", "publish"];

export const ALLOWLIST_FETCH_CAPABILITY = "network:fetch:allowlist";
export const SANDBOX_EXECUTE_CAPABILITY = "code:execute:sandbox";

export function defaultKnowledgeWorkCapabilities(
  workspaceRoot: string,
  approvedDestinations: string[] = [],
): TaskCapabilities {
  const allowlist = [...approvedDestinations];
  const granted = [
    "files:read:task",
    "files:write:output",
    "tool:invoke",
    "spreadsheet:create",
    "spreadsheet:modify",
    "presentation:create",
    "document:create",
    "research:review:attached",
    "artifact:inspect",
    "quality:check",
    "pdf:open",
    "pdf:ocr",
    "spreadsheet:open",
    SANDBOX_EXECUTE_CAPABILITY,
  ];
  const denied = [...DEFAULT_DENIED_CAPABILITIES];
  if (allowlist.length > 0) {
    granted.push(ALLOWLIST_FETCH_CAPABILITY);
  } else {
    denied.push(ALLOWLIST_FETCH_CAPABILITY);
  }
  return {
    workspaceRoot,
    allowedReadPrefixes: ["sources/", "originals/"],
    allowedWritePrefixes: ["artifacts/", "findings.json"],
    networkAllowlist: allowlist,
    sensitiveDestinations: [
      "https://partner-api.example",
      "mailto:board@example.com",
    ],
    canExport: false,
    maxSteps: 64,
    granted,
    denied,
    requireApproval: [...DEFAULT_APPROVAL_CAPABILITIES],
  };
}

/**
 * Cedarline Claims — embedded third-party worker tools.
 * Registered here so the same control plane can enforce them. Not a second plane.
 */
export const CLAIMS_TOOL_REGISTRATION = [
  { tool: "claims.read" as const, capability: "claims:read", requireApproval: false },
  { tool: "claims.update" as const, capability: "claims:update", requireApproval: false },
  { tool: "claims.pay" as const, capability: "claims:pay", requireApproval: true },
  { tool: "unrelated.data" as const, capability: "unrelated:data", requireApproval: false },
];

export function claimsWorkerCapabilities(workspaceRoot: string): TaskCapabilities {
  return {
    workspaceRoot,
    allowedReadPrefixes: ["sources/", "originals/"],
    allowedWritePrefixes: ["artifacts/", "findings.json"],
    networkAllowlist: [],
    sensitiveDestinations: [],
    canExport: false,
    maxSteps: 16,
    granted: ["files:read:task", "files:write:output", "claims:read", "claims:update", "claims:pay"],
    denied: [
      ...DEFAULT_DENIED_CAPABILITIES,
      "unrelated:data",
      ALLOWLIST_FETCH_CAPABILITY,
      SANDBOX_EXECUTE_CAPABILITY,
      "spreadsheet:create",
    ],
    requireApproval: ["claims:pay", ...DEFAULT_APPROVAL_CAPABILITIES],
  };
}

const KNOWN_TOOL_NAMES = new Set<string>(Object.keys(TOOL_CAPABILITY));

export function isKnownActionName(tool: string): tool is KnownActionName {
  return KNOWN_TOOL_NAMES.has(tool);
}

export function capabilityForTool(tool: ActionName, capabilities: TaskCapabilities): string | undefined {
  if (isKnownActionName(tool)) return TOOL_CAPABILITY[tool];
  return capabilities.registeredTools?.find((item) => item.name === tool)?.capability;
}

export function uniqueCapabilities(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Capabilities for a developer-declared worker. Derived from registered tools
 * plus any extra lists the developer sent. Not a second control plane.
 */
export function developerWorkerCapabilities(
  workspaceRoot: string,
  brief: Pick<
    TaskBrief,
    "registeredTools" | "developerGranted" | "developerDenied" | "developerRequireApproval"
  >,
): TaskCapabilities {
  const tools: RegisteredTool[] = brief.registeredTools ?? [];
  const fromAllow = tools.filter((tool) => tool.policy !== "deny").map((tool) => tool.capability);
  const fromDeny = tools.filter((tool) => tool.policy === "deny").map((tool) => tool.capability);
  const fromApproval = tools
    .filter((tool) => tool.policy === "require_approval")
    .map((tool) => tool.capability);
  return {
    workspaceRoot,
    allowedReadPrefixes: ["sources/", "originals/", "artifacts/"],
    allowedWritePrefixes: ["artifacts/", "findings.json"],
    networkAllowlist: [],
    sensitiveDestinations: [],
    canExport: false,
    maxSteps: 32,
    granted: uniqueCapabilities([
      "files:read:task",
      "files:write:output",
      ...fromAllow,
      ...(brief.developerGranted ?? []),
    ]),
    denied: uniqueCapabilities([
      ...DEFAULT_DENIED_CAPABILITIES,
      ALLOWLIST_FETCH_CAPABILITY,
      SANDBOX_EXECUTE_CAPABILITY,
      "spreadsheet:create",
      ...fromDeny,
      ...(brief.developerDenied ?? []),
    ]),
    requireApproval: uniqueCapabilities([
      ...DEFAULT_APPROVAL_CAPABILITIES,
      ...fromApproval,
      ...(brief.developerRequireApproval ?? []),
    ]),
    registeredTools: tools,
  };
}
