/**
 * Shared contracts between WorkerLayer's three layers.
 *
 * Agent, control plane, and workstation may all import this module.
 * The agent must not import the control plane or workstation.
 * Package paths stay `@aether/*` until a later rename.
 */

export const PRODUCT_NAME = "WorkerLayer";
export const PRODUCT_TAGLINE = "The platform for deploying autonomous AI workers";
export const PRODUCT_MOTTO = "Ideas → AI workers → real outcomes";
export const PRODUCT_ALPHA_LABEL = "Alpha — not for sensitive production workloads";
export const PRODUCT_ALPHA_SYNTHETIC = "Synthetic or non-sensitive files only";
export const PRODUCT_SUCCESS =
  "Success is ALLOW / ALLOW / DENY in the audit, not only finished work";
export const PRODUCT_SKETCH_REVIEW = "This is a sketch. You still choose what to grant.";
export const PRODUCT_SKETCH_LABEL = "sketch / suggested tools";
export const PRODUCT_GRANT_SELECTED = "Grant selected";
export const PRODUCT_LEFTOVER_DENY =
  "Not selected from the sketch. Stays off this Task Manifest — DENY if requested.";

/** One line for strangers: sticky compute + DENY-as-success + propose does not grant. */
export function productStrangerLine(computeProvider: string): string {
  return `${PRODUCT_NAME} Alpha — compute ${computeProvider} (sticky per Task; you do not choose). ${PRODUCT_SUCCESS}. POST /api/v1/propose does not grant.`;
}

/** Slide thesis: the stack builders otherwise assemble themselves. */
export const PRODUCT_STACK_FROM = [
  "model/agent",
  "python",
  "sandbox/VM",
  "files",
  "browser",
  "tools/MCP",
  "credentials",
  "policy",
  "approvals",
  "audit",
  "lifecycle",
] as const;

/** Slide thesis: what a WorkerEnvironment focuses. */
export const PRODUCT_STACK_TO = [
  "browser/computer",
  "identity",
  "tools",
  "policy",
  "audit",
  "lifecycle",
] as const;

/** First-party tools. Developer API tools are additional strings. */
export type KnownActionName =
  | "workspace.list_files"
  | "workspace.read_file"
  | "workspace.ingest_sources"
  | "pdf.extract_text"
  | "pdf.open"
  | "pdf.ocr"
  | "spreadsheet.open"
  | "research.review_sources"
  | "analysis.record_findings"
  | "spreadsheet.create"
  | "spreadsheet.update"
  | "presentation.create"
  | "document.create"
  | "artifact.inspect"
  | "quality.check"
  | "artifact.validate"
  | "export.send_external"
  | "network.fetch"
  | "python.execute"
  | "claims.read"
  | "claims.update"
  | "claims.pay"
  | "unrelated.data";

/** Tool name. Known first-party tools plus developer-registered names. */
export type ActionName = KnownActionName | (string & {});

export type ArtifactKind = "spreadsheet" | "presentation" | "document" | "file";

export type Decision = "allow" | "deny" | "require_approval";

/** A tool a developer registered on a WorkerEnvironment. */
export interface RegisteredTool {
  name: string;
  capability: string;
  policy: Decision;
}

/** Sketch row from EnvironmentCompiler.propose. Reasons are advisory. */
export interface SuggestedTool extends RegisteredTool {
  reason: string;
}

/** Human grant decision. Never copied from a proposal automatically. Task-scoped. */
export interface GrantLeftoverDenial {
  name: string;
  capability: string;
  reason: string;
}

export interface GrantReviewRecord {
  at: string;
  auto: false;
  confirm: true;
  scope: "task";
  grantedBy: "human";
  grantor: string;
  worker: string;
  workerId?: string;
  taskId: string;
  environmentId: string;
  sketchId?: string;
  sketchHash?: string;
  capabilitiesAdded: string[];
  capabilitiesRemoved: string[];
  selectedTools: RegisteredTool[];
  leftoverDenials: GrantLeftoverDenial[];
  proposalGoal?: string;
  sketchedToolNames: string[];
  note: string;
  principalId?: string;
}

export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "awaiting_review"
  | "accepted"
  | "rejected"
  | "failed"
  | "blocked_on_approval";

export type ReviewAction = "accept" | "reject" | "request_fix";

export type FixTarget = "consistency" | "uncertainty" | "citations" | "slides";

export const FIX_TARGETS: Array<{ id: FixTarget; label: string }> = [
  { id: "consistency", label: "Align names and numbers across the spreadsheet and slides" },
  { id: "uncertainty", label: "Flag uncertainty and conflicts more clearly" },
  { id: "citations", label: "Cite sources more clearly in the pack" },
  { id: "slides", label: "Fix empty, short, or missing slides" },
];

export interface ReviewEvent {
  at: string;
  action: ReviewAction;
  target?: FixTarget;
  label?: string;
}

export interface ReviewRecord {
  status: "pending" | "accepted" | "rejected";
  fixRequests: number;
  interventions: number;
  lastTarget?: FixTarget;
  history: ReviewEvent[];
}

export type PrincipalType = "user" | "agent" | "control-plane" | "workstation";

export interface Principal {
  type: PrincipalType;
  id: string;
  name: string;
  /** First-party agents are still untrusted for authorization. */
  untrusted?: boolean;
}

export interface ActionRequest {
  id: string;
  taskId: string;
  tool: ActionName;
  args: Record<string, unknown>;
  requestedBy: "agent";
  rationale?: string;
}

export interface PolicyDecision {
  requestId: string;
  decision: Decision;
  reason: string;
  policyId: string;
}

export interface ExecutionGrant {
  grantId: string;
  requestId: string;
  taskId: string;
  tool: ActionName;
  argsDigest: string;
  issuedAt: string;
}

export interface ActionResult {
  ok: boolean;
  status: "succeeded" | "denied" | "pending_approval" | "failed";
  data?: Record<string, unknown>;
  error?: string;
  approvalId?: string;
}

export interface HandledAction {
  request: ActionRequest;
  decision: PolicyDecision;
  result: ActionResult;
  grant?: ExecutionGrant;
}

export interface AuditEvent {
  id: string;
  taskId: string;
  timestamp: string;
  actor: PrincipalType;
  action: string;
  decision?: Decision;
  tool?: ActionName;
  details: Record<string, unknown>;
}

export interface Citation {
  id: string;
  source: string;
  path: string;
  excerpt?: string;
}

export interface UncertaintyFlag {
  id: string;
  note: string;
  reason: "single-source" | "forward-looking" | "gap" | "unverified";
  relatedFinding?: string;
}

export interface Finding {
  category: string;
  finding: string;
  evidence: string;
  source: string;
  confidence: "high" | "medium" | "low";
  citationId?: string;
  uncertain?: boolean;
  uncertaintyNote?: string;
}

export interface ResearchReview {
  method: "attached-materials-only";
  sources: Array<{ path: string; bytes: number; kind: string }>;
  coverage: string[];
  gaps: string[];
  notes: string[];
}

export interface CompanyRecord {
  name: string;
  businessModel?: string;
  customers?: string;
  funding?: string;
  products?: string;
  differentiators?: string;
  sources: string[];
  missing: string[];
  conflicts: Array<{ field: string; values: string[] }>;
}

export interface RecordedAnalysis {
  company?: string;
  summary?: string;
  findings: Finding[];
  citations?: Citation[];
  uncertainties?: UncertaintyFlag[];
  companies?: CompanyRecord[];
}

export interface QualityIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  artifact?: ArtifactKind | "analysis";
}

export interface QualityReport {
  ok: boolean;
  issues: QualityIssue[];
  inspected: string[];
  pass: "draft" | "corrected" | "final";
  /** 0–1. Would a user send this after one review? */
  deliveryScore?: number;
  sendableAfterOneReview?: boolean;
}

export interface GovernanceMetrics {
  authorizedActions: number;
  deniedActions: number;
  approvalRequests: number;
  capabilitiesGranted: number;
  capabilitiesRequested: string[];
  policyFailures: number;
  crossTaskAccessAttempts: number;
}

/**
 * Replaceable compute HOW. Auto-default: Docker when the daemon is healthy,
 * else unshare-mount, else process-filesystem. Sticky per Task. Customers
 * do not choose the backend or the substrate.
 */
export type ComputeProviderKind = "docker" | "unshare-mount" | "process-filesystem";
export type ExecutionProviderKind = ComputeProviderKind;

export type BuiltinWorkerKind = "knowledge" | "claims" | "developer" | "chief_of_staff";
/** Open string so a vertical can register a kind without editing this union. */
export type WorkerKind = BuiltinWorkerKind | (string & {});

/** Persistent logical AI worker. Survives across Tasks. Not an account system. */
export interface WorkerRecord {
  id: string;
  name: string;
  kind: WorkerKind;
  status: "active" | "retired";
  capabilityManifestId: string;
  createdAt: string;
  taskIds: string[];
}

/** Declared capabilities for a Worker, snapshotted onto a Task. */
export interface CapabilityManifest {
  id: string;
  workerId: string;
  granted: string[];
  denied: string[];
  requireApproval: string[];
  approvedDestinations: string[];
  registeredTools?: RegisteredTool[];
  compiledFrom: "declared";
}

export interface TaskIsolationRecord {
  provider: ExecutionProviderKind;
  environmentId: string;
  status: "ready" | "destroyed";
  hostPathsBlocked: number;
}

/**
 * What the worker is allowed to do. Adapters choose HOW.
 * MCP_TOOL, BROWSER (full), and COMPUTER are declared so the compiler
 * has a place for them. Milestone 1 only executes DIRECT_TOOL and SANDBOX.
 */
export type ExecutionSubstrate =
  | "DIRECT_TOOL"
  | "MCP_TOOL"
  | "BROWSER"
  | "SANDBOX"
  | "COMPUTER";

/** M1: capabilities are listed. The compiler must not infer more. */
export type EnvironmentCompileMode = "declared";

export interface WorkerEnvironmentSpec {
  assignmentId: string;
  workerId?: string;
  capabilityManifestId?: string;
  capabilities: string[];
  deniedCapabilities: string[];
  substrates: ExecutionSubstrate[];
  approvedDestinations: string[];
  compiledFrom: EnvironmentCompileMode;
}

export interface WorkerEnvironmentRecord {
  id: string;
  assignmentId: string;
  spec: WorkerEnvironmentSpec;
  status: "ready" | "destroyed";
  computeProvider: ExecutionProviderKind;
  substrates: ExecutionSubstrate[];
  hostPathsBlocked: number;
  createdAt: string;
  destroyedAt?: string;
}

export interface EvaluationReport {
  taskSuccess: boolean;
  artifactCompleteness: number;
  citationCoverage: number;
  factualAccuracy: number;
  crossArtifactConsistency: number;
  visualDefects: number;
  userInterventions: number;
  runtimeMs: number;
  modelCostUsd: number;
  selfReviewCycles: number;
  notes: string[];
  sendableAfterOneReview?: boolean;
  deliveryScore?: number;
  leftoverGaps?: number;
  authorizedActions?: number;
  deniedActions?: number;
  approvalRequests?: number;
  capabilitiesRequested?: string[];
  capabilitiesGranted?: number;
  policyFailures?: number;
  crossTaskAccessAttempts?: number;
}

export interface PlanStep {
  id: string;
  title: string;
  detail: string;
  status: "pending" | "in_progress" | "done" | "blocked" | "skipped";
}

export interface WorkPlan {
  summary: string;
  steps: PlanStep[];
}

export interface ApprovalTicket {
  id: string;
  taskId: string;
  request: ActionRequest;
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export type WorkerIdentityStatus = "active" | "expired";

export interface TaskWorkerIdentity {
  id: string;
  taskId: string;
  issuedAt: string;
  expiresAt: string;
  status: WorkerIdentityStatus;
  granted: string[];
  denied: string[];
  requireApproval: string[];
}

export interface TaskCapabilities {
  workspaceRoot: string;
  allowedReadPrefixes: string[];
  allowedWritePrefixes: string[];
  networkAllowlist: string[];
  sensitiveDestinations: string[];
  canExport: boolean;
  maxSteps: number;
  /** Prototype capability names. Not enterprise RBAC. */
  granted: string[];
  /** Product-visible denials for this assignment. Policy still deny-by-default. */
  denied: string[];
  /** Actions that escalate to a human instead of executing. */
  requireApproval: string[];
  /** Developer-registered tools for this assignment. Absent for first-party workers. */
  registeredTools?: RegisteredTool[];
}

export interface TaskBrief {
  id: string;
  goal: string;
  createdAt: string;
  createdBy: Principal;
  sourceFiles: Array<{ name: string; relativePath: string }>;
  /** Exact destinations this assignment may fetch. Empty means none. */
  approvedDestinations?: string[];
  /** Persistent Worker this assignment belongs to. */
  workerId?: string;
  /** CapabilityManifest snapshotted for this assignment. */
  capabilityManifestId?: string;
  /** Which declared worker this assignment runs. Default is the first-party knowledge worker. */
  workerKind?: WorkerKind;
  /** Developer API environment this assignment is bound to. */
  environmentId?: string;
  /** API-key principal that owns this Task. Absent on desk dogfood. */
  principalId?: string;
  /** Snapshot of developer-registered tools at run. */
  registeredTools?: RegisteredTool[];
  developerGranted?: string[];
  developerDenied?: string[];
  developerRequireApproval?: string[];
}

/** Declared WorkerEnvironment a developer created through the API. Isolation is composed at run. */
export interface DeveloperEnvironmentRecord {
  id: string;
  worker: string;
  status: "ready" | "destroyed";
  tools: RegisteredTool[];
  granted: string[];
  denied: string[];
  requireApproval: string[];
  taskIds: string[];
  createdAt: string;
  destroyedAt?: string;
  latestEnvironment?: WorkerEnvironmentRecord;
  /** API-key principal that owns this environment. Absent on in-process tests. */
  principalId?: string;
  /** Present when this environment was created through human grant-review. */
  grantReview?: GrantReviewRecord;
}

export interface ArtifactRecord {
  name: string;
  relativePath: string;
  kind: ArtifactKind;
  title?: string;
  createdAt: string;
  validated?: boolean;
  validationNotes?: string[];
}

export interface GrantVerifier {
  verify(grant: ExecutionGrant, request: ActionRequest): boolean;
  consume(grantId: string): void;
}

export type AgentIntent =
  | { type: "request"; request: ActionRequest }
  | { type: "finish"; summary: string };

export { id, nowIso } from "./ids";
