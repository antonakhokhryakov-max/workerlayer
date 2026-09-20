import type {
  ExecutionSubstrate,
  WorkerEnvironmentRecord,
  WorkerEnvironmentSpec,
} from "@aether/contracts";
import { nowIso } from "@aether/contracts";
import type { TaskEnvironment } from "./isolation";
import { defaultAdapters, type SubstrateAdapter } from "./substrates";

/**
 * The composed product object. Not a renamed Docker/VM.
 * Spec + isolation HOW + substrate adapters, for one assignment.
 */
export class WorkerEnvironment {
  readonly createdAt: string;
  destroyedAt?: string;

  constructor(
    readonly spec: WorkerEnvironmentSpec,
    readonly isolation: TaskEnvironment,
    readonly adapters: SubstrateAdapter[] = defaultAdapters(),
  ) {
    this.createdAt = nowIso();
  }

  get id(): string {
    return this.isolation.id;
  }

  get substrates(): ExecutionSubstrate[] {
    return this.spec.substrates;
  }

  record(): WorkerEnvironmentRecord {
    return {
      id: this.id,
      assignmentId: this.spec.assignmentId,
      spec: this.spec,
      status: this.isolation.status,
      computeProvider: this.isolation.kind,
      substrates: [...this.spec.substrates],
      hostPathsBlocked: this.isolation.record().hostPathsBlocked,
      createdAt: this.createdAt,
      destroyedAt: this.isolation.status === "destroyed" ? (this.destroyedAt ?? nowIso()) : undefined,
    };
  }

  markDestroyed(): WorkerEnvironmentRecord {
    this.destroyedAt = nowIso();
    return this.record();
  }
}

export function composeWorkerEnvironment(
  spec: WorkerEnvironmentSpec,
  isolation: TaskEnvironment,
): WorkerEnvironment {
  return new WorkerEnvironment(spec, isolation);
}
