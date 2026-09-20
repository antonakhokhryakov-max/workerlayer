import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  ApprovalTicket,
  ArtifactRecord,
  AuditEvent,
  CapabilityManifest,
  Citation,
  CompanyRecord,
  DeveloperEnvironmentRecord,
  EvaluationReport,
  Finding,
  GovernanceMetrics,
  QualityReport,
  TaskIsolationRecord,
  WorkerEnvironmentRecord,
  WorkerRecord,
  ResearchReview,
  ReviewRecord,
  TaskBrief,
  TaskStatus,
  TaskWorkerIdentity,
  UncertaintyFlag,
  WorkPlan,
} from "@aether/contracts";
import { dataRoot, taskDir } from "./paths";

export function emptyReview(): ReviewRecord {
  return { status: "pending", fixRequests: 0, interventions: 0, history: [] };
}

export interface StoredTask {
  brief: TaskBrief;
  status: TaskStatus;
  plan?: WorkPlan;
  summary?: string;
  company?: string;
  findings: Finding[];
  citations?: Citation[];
  uncertainties?: UncertaintyFlag[];
  companies?: CompanyRecord[];
  researchNotes?: ResearchReview;
  quality?: QualityReport;
  qualityDraft?: QualityReport;
  openedFiles?: string[];
  evaluation?: EvaluationReport;
  artifacts: ArtifactRecord[];
  identity?: TaskWorkerIdentity;
  isolation?: TaskIsolationRecord;
  environment?: WorkerEnvironmentRecord;
  review?: ReviewRecord;
  governance?: GovernanceMetrics;
  error?: string;
  modelProvider: string;
}

export class TaskStore {
  constructor(private readonly root = dataRoot()) {}

  dataRoot(): string {
    return this.root;
  }

  save(task: StoredTask): void {
    const dir = taskDir(task.brief.id, this.root);
    writeFileSync(join(dir, "task.json"), JSON.stringify(task, null, 2));
  }

  saveApprovals(taskId: string, tickets: ApprovalTicket[]): void {
    writeFileSync(
      join(taskDir(taskId, this.root), "approvals.json"),
      JSON.stringify(tickets, null, 2),
    );
  }

  loadApprovals(taskId: string): ApprovalTicket[] {
    const file = join(taskDir(taskId, this.root), "approvals.json");
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf8")) as ApprovalTicket[];
  }

  get(taskId: string): StoredTask | undefined {
    const file = join(taskDir(taskId, this.root), "task.json");
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as StoredTask;
  }

  list(): StoredTask[] {
    const root = join(this.root, "tasks");
    if (!existsSync(root)) return [];
    return readdirSync(root)
      .filter((id) => {
        try {
          return statSync(join(root, id)).isDirectory();
        } catch {
          return false;
        }
      })
      .map((id) => this.get(id))
      .filter((task): task is StoredTask => Boolean(task))
      .sort((a, b) => b.brief.createdAt.localeCompare(a.brief.createdAt));
  }

  auditPath(taskId: string): string {
    return join(taskDir(taskId, this.root), "audit.jsonl");
  }

  readAudit(taskId: string): AuditEvent[] {
    const file = this.auditPath(taskId);
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent);
  }

  workspaceRoot(taskId: string): string {
    const dir = taskDir(taskId, this.root);
    mkdirSync(join(dir, "sources"), { recursive: true });
    mkdirSync(join(dir, "originals"), { recursive: true });
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    return dir;
  }

  sealOriginals(taskId: string): void {
    const dir = this.workspaceRoot(taskId);
    const sources = join(dir, "sources");
    const originals = join(dir, "originals");
    if (!existsSync(sources)) return;
    for (const name of readdirSync(sources)) {
      const from = join(sources, name);
      const to = join(originals, name);
      if (!existsSync(to)) {
        writeFileSync(to, readFileSync(from));
      }
    }
  }

  listSources(taskId: string): Array<{ name: string; bytes: number }> {
    const dir = join(this.workspaceRoot(taskId), "originals");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => !name.startsWith("."))
      .map((name) => ({
        name,
        bytes: readFileSync(join(dir, name)).length,
      }));
  }

  readSource(taskId: string, name: string): Buffer | undefined {
    const file = join(this.workspaceRoot(taskId), "originals", name);
    if (!existsSync(file)) return undefined;
    return readFileSync(file);
  }

  environmentDir(): string {
    const dir = join(this.root, "environments");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  saveEnvironment(environment: DeveloperEnvironmentRecord): void {
    writeFileSync(
      join(this.environmentDir(), `${environment.id}.json`),
      JSON.stringify(environment, null, 2),
    );
  }

  getEnvironment(environmentId: string): DeveloperEnvironmentRecord | undefined {
    const file = join(this.environmentDir(), `${environmentId}.json`);
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as DeveloperEnvironmentRecord;
  }

  listArtifactFiles(taskId: string): Array<{ name: string; relativePath: string; bytes: number }> {
    const dir = join(this.workspaceRoot(taskId), "artifacts");
    if (!existsSync(dir)) return [];
    const collected: Array<{ name: string; relativePath: string; bytes: number }> = [];
    const walk = (current: string, prefix: string) => {
      for (const entry of readdirSync(current)) {
        const abs = join(current, entry);
        const rel = prefix ? `${prefix}/${entry}` : entry;
        const stat = statSync(abs);
        if (stat.isDirectory()) walk(abs, rel);
        else {
          collected.push({
            name: entry,
            relativePath: `artifacts/${rel}`,
            bytes: stat.size,
          });
        }
      }
    };
    walk(dir, "");
    return collected;
  }

  readArtifact(taskId: string, relativePath: string): Buffer | undefined {
    const nested = relativePath.replace(/^artifacts\//, "");
    const file = join(this.workspaceRoot(taskId), "artifacts", nested);
    if (!existsSync(file) || statSync(file).isDirectory()) return undefined;
    return readFileSync(file);
  }

  private workersDir(): string {
    const dir = join(this.root, "workers");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private manifestsDir(): string {
    const dir = join(this.root, "manifests");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  saveWorker(worker: WorkerRecord): void {
    writeFileSync(join(this.workersDir(), `${worker.id}.json`), JSON.stringify(worker, null, 2));
  }

  getWorker(workerId: string): WorkerRecord | undefined {
    const file = join(this.workersDir(), `${workerId}.json`);
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as WorkerRecord;
  }

  listWorkers(): WorkerRecord[] {
    return readdirSync(this.workersDir())
      .filter((name) => name.endsWith(".json"))
      .map((name) => JSON.parse(readFileSync(join(this.workersDir(), name), "utf8")) as WorkerRecord)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  saveManifest(manifest: CapabilityManifest): void {
    writeFileSync(
      join(this.manifestsDir(), `${manifest.id}.json`),
      JSON.stringify(manifest, null, 2),
    );
  }

  getManifest(manifestId: string): CapabilityManifest | undefined {
    const file = join(this.manifestsDir(), `${manifestId}.json`);
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8")) as CapabilityManifest;
  }
}
