import { AetherPlatform, TaskStore, DeveloperApi } from "@aether/runtime";
import { assertHostCompute } from "@/lib/host-mode";

let store: TaskStore | undefined;
let developerApi: DeveloperApi | undefined;
let platform: AetherPlatform | undefined;

export function getStore(): TaskStore {
  assertHostCompute("TaskStore");
  store ??= new TaskStore();
  return store;
}

export function getPlatform(): AetherPlatform {
  assertHostCompute("startTask / WorkerEnvironment");
  platform ??= new AetherPlatform(getStore());
  return platform;
}

export function getDeveloperApi(): DeveloperApi {
  // Desk dogfood. No API key — grantor is desk-session. Keyed strangers use /api/v1.
  assertHostCompute("DeveloperApi / Manifest exec");
  developerApi ??= new DeveloperApi(getStore());
  return developerApi;
}
