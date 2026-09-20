import {
  PRODUCT_ALPHA_LABEL,
  PRODUCT_ALPHA_SYNTHETIC,
  PRODUCT_MOTTO,
  PRODUCT_NAME,
  PRODUCT_SKETCH_REVIEW,
  PRODUCT_SUCCESS,
  productStrangerLine,
} from "@aether/contracts";
import { createHash, timingSafeEqual } from "node:crypto";
import { detectDockerHealthy, selectComputeProvider } from "@aether/workstation";
import { DeveloperApi, DeveloperApiError } from "./developer-api";
import { environmentCompiler, requireHumanGrantSelection } from "./propose";

export interface V1Result {
  status: number;
  body: Record<string, unknown>;
}

export type V1AuthCode = "missing_api_key" | "invalid_api_key";

export type V1Auth =
  | { ok: true; principalId: string }
  | { ok: false; status: 401; body: { error: string; code: V1AuthCode } };

const UNSET_KEY =
  "Set AETHER_API_KEY before serving /api/v1. The developer API is not open. Copy .env.example to .env. The assignment desk does not use this key.";
const MISSING_KEY =
  "Missing API key. Send Authorization: Bearer <AETHER_API_KEY> or X-Api-Key.";
const INVALID_KEY = "Invalid API key.";

export function configuredApiKeys(
  value: string | string[] | undefined = undefined,
): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  const fromEnv = [
    process.env.AETHER_API_KEY,
    ...(process.env.AETHER_API_KEYS ?? "").split(","),
  ];
  return [...new Set(fromEnv.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
}

export function configuredApiKey(
  value: string | undefined = process.env.AETHER_API_KEY,
): string {
  return configuredApiKeys(value)[0] ?? "";
}

/** Hash of the API key. Identity / principal only — never a capability grant. */
export function principalIdFromKey(key: string): string {
  return `pri_${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

/**
 * Shared local key for /api/v1. Not SSO. Not JWT scopes.
 * Desk UI does not use this. The key identifies a principal; it does not grant tools.
 */
export function authorizeV1(
  headers: Headers | NodeJS.Dict<string | string[] | undefined>,
  expectedKey: string | string[] | undefined = undefined,
): V1Auth {
  const expected = configuredApiKeys(expectedKey);
  if (expected.length === 0) {
    return { ok: false, status: 401, body: { error: UNSET_KEY, code: "missing_api_key" } };
  }
  const provided = readPresentedKey(headers);
  if (!provided) {
    return { ok: false, status: 401, body: { error: MISSING_KEY, code: "missing_api_key" } };
  }
  const matched = expected.find((key) => apiKeysMatch(provided, key));
  if (!matched) {
    return { ok: false, status: 401, body: { error: INVALID_KEY, code: "invalid_api_key" } };
  }
  return { ok: true, principalId: principalIdFromKey(matched) };
}

function readPresentedKey(
  headers: Headers | NodeJS.Dict<string | string[] | undefined>,
): string {
  const authorization = readHeader(headers, "authorization");
  if (authorization) {
    const bearer = /^Bearer\s+(\S+)/i.exec(authorization);
    if (bearer?.[1]) return bearer[1].trim();
  }
  return readHeader(headers, "x-api-key") ?? "";
}

function readHeader(
  headers: Headers | NodeJS.Dict<string | string[] | undefined>,
  name: string,
): string | undefined {
  if (typeof (headers as Headers).get === "function") {
    const value = (headers as Headers).get(name) ?? (headers as Headers).get(name.toLowerCase());
    return value?.trim() || undefined;
  }
  const record = headers as NodeJS.Dict<string | string[] | undefined>;
  const raw = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] ?? "").trim() || undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  return undefined;
}

function apiKeysMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function normalizeV1Path(pathname: string): string {
  return pathname.replace(/^\/?api\/v1\/?/, "").replace(/^\//, "").replace(/\/$/, "");
}

export function v1HealthBody(): Record<string, unknown> {
  const provider = selectComputeProvider();
  return {
    ok: true,
    product: PRODUCT_NAME,
    motto: PRODUCT_MOTTO,
    alpha: PRODUCT_ALPHA_LABEL,
    synthetic: PRODUCT_ALPHA_SYNTHETIC,
    success: PRODUCT_SUCCESS,
    stranger: productStrangerLine(provider.kind),
    api: "v1",
    hint: "POST /api/v1/propose is a sketch — nothing is granted. POST /api/v1/grant requires the tools you choose and confirm: true. Customers do not choose compute or substrate.",
    compute: {
      provider: provider.kind,
      dockerHealthy: detectDockerHealthy(),
      stickyPerTask: true,
      customerChooses: false,
      oemChooses: false,
    },
  };
}

export async function dispatchV1(
  api: DeveloperApi,
  method: string,
  pathname: string,
  body: unknown,
): Promise<V1Result> {
  try {
    const path = normalizeV1Path(pathname);
    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const result = await route(api, method.toUpperCase(), path, payload);
    return result;
  } catch (error) {
    if (error instanceof DeveloperApiError) {
      return { status: error.status, body: { error: error.message } };
    }
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

async function route(
  api: DeveloperApi,
  method: string,
  path: string,
  body: Record<string, unknown>,
): Promise<V1Result> {
  const parts = path.split("/").filter(Boolean);

  if (method === "GET" && (parts.length === 0 || (parts.length === 1 && parts[0] === "health"))) {
    return { status: 200, body: v1HealthBody() };
  }

  if (method === "POST" && parts.length === 1 && parts[0] === "propose") {
    const proposal = environmentCompiler.propose(body.goal);
    if (proposal.granted !== false) {
      throw new DeveloperApiError(500, "A proposal must not grant.");
    }
    return {
      status: 200,
      body: {
        proposal: { ...proposal, granted: false },
        review: PRODUCT_SKETCH_REVIEW,
      },
    };
  }

  if (method === "POST" && parts.length === 1 && parts[0] === "grant") {
    const selection = requireHumanGrantSelection(body);
    const { environment, task } = api.grantReviewed(selection);
    return {
      status: 201,
      body: {
        environment,
        task: view(task),
        review: PRODUCT_SKETCH_REVIEW,
        grant: environment.grantReview,
      },
    };
  }

  if (method === "POST" && parts.length === 1 && parts[0] === "environments") {
    return { status: 201, body: { environment: api.createEnvironment(body) } };
  }

  if (parts[0] === "environments" && parts[1]) {
    const environmentId = parts[1];
    if (method === "GET" && parts.length === 2) {
      return { status: 200, body: { environment: api.getEnvironment(environmentId) } };
    }
    if (method === "POST" && parts[2] === "tools" && parts.length === 3) {
      return {
        status: 200,
        body: { environment: api.registerTools(environmentId, body.tools ?? body) },
      };
    }
    if (method === "POST" && parts[2] === "capabilities" && parts.length === 3) {
      return { status: 200, body: { environment: api.declareCapabilities(environmentId, body) } };
    }
    if (method === "POST" && parts[2] === "destroy" && parts.length === 3) {
      return { status: 200, body: { environment: api.destroyEnvironment(environmentId) } };
    }
  }

  if (method === "POST" && parts.length === 1 && parts[0] === "tasks") {
    return { status: 201, body: { task: view(api.createTask(body)) } };
  }

  if (parts[0] === "tasks" && parts[1]) {
    const taskId = parts[1];
    if (method === "GET" && parts.length === 2) {
      return { status: 200, body: { task: api.status(taskId) } };
    }
    if (method === "POST" && parts[2] === "files" && parts.length === 3) {
      return { status: 200, body: api.attachFile(taskId, body) };
    }
    if (method === "POST" && parts[2] === "run" && parts.length === 3) {
      return { status: 200, body: { task: await api.run(taskId, body) } };
    }
    if (method === "GET" && parts[2] === "audit" && parts.length === 3) {
      return { status: 200, body: { audit: api.audit(taskId) } };
    }
    if (method === "GET" && parts[2] === "outputs" && parts.length === 3) {
      return { status: 200, body: api.outputs(taskId) };
    }
    if (method === "GET" && parts[2] === "status" && parts.length === 3) {
      return { status: 200, body: { task: api.status(taskId) } };
    }
  }

  return { status: 404, body: { error: "Unknown developer API route." } };
}

function view(task: ReturnType<DeveloperApi["createTask"]>) {
  return {
    id: task.brief.id,
    goal: task.brief.goal,
    status: task.status,
    environmentId: task.brief.environmentId,
    workerKind: task.brief.workerKind,
  };
}
