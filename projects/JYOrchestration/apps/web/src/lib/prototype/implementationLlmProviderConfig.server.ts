import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { prisma } from "@/lib/prisma";
import {
  isProductionNodeEnv,
  parseImplementationLlmProviderConfigWire,
  pickImplementationLlmProviderConfig,
  type ImplementationLlmProviderConfigV1,
} from "@/lib/prototype/implementationLlmProviderConfigWire";

export type { ImplementationLlmProviderConfigV1 } from "@/lib/prototype/implementationLlmProviderConfigWire";

export type ImplementationLlmProviderResolutionStatus = "ok" | "provider_config_missing";

export type ImplementationLlmProviderConfigRecord = Readonly<{
  apiKey: string | null;
  config: ImplementationLlmProviderConfigV1 | null;
  providerSource: "project_execution_setup" | "user_default" | "dev_env_fallback" | "none";
  status: ImplementationLlmProviderResolutionStatus;
  envFallback: boolean;
}>;

function allowEnvOpenAiFallback(): boolean {
  return !isProductionNodeEnv(process.env.NODE_ENV);
}

function parseVisionFromEnv(): boolean | null {
  const raw = String(process.env.JYO_IMPLEMENTATION_LLM_VISION_ENABLED ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return null;
}

function parseModelFromEnv(): string | null {
  const m = String(process.env.JYO_IMPLEMENTATION_LLM_MODEL ?? "").trim();
  return m || null;
}

function readRequirementsStateRoot(raw: unknown): Record<string, unknown> | null {
  let root: unknown = raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    try {
      root = JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  }
  if (!root || typeof root !== "object") return null;
  return root as Record<string, unknown>;
}

function readInlineConfigFromRequirementsState(requirementsStateJson?: unknown): ImplementationLlmProviderConfigV1 | null {
  if (!requirementsStateJson) return null;
  try {
    const o = readRequirementsStateRoot(requirementsStateJson);
    if (!o) return null;
    return parseImplementationLlmProviderConfigWire(o.implementationLlmProviderConfigV1);
  } catch {
    return null;
  }
}

async function loadProjectProviderConfigFromDb(projectId: string): Promise<ImplementationLlmProviderConfigV1 | null> {
  if (!projectId.trim()) return null;
  try {
    const setup = await prisma.executionSetup.findUnique({
      where: { projectId: projectId.trim() },
      select: { implementationLlmProviderConfigJson: true },
    });
    return parseImplementationLlmProviderConfigWire(setup?.implementationLlmProviderConfigJson);
  } catch {
    return null;
  }
}

async function loadUserProviderConfigFromDb(userId: string): Promise<ImplementationLlmProviderConfigV1 | null> {
  if (!userId.trim()) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId.trim() },
      select: { implementationLlmProviderConfigJson: true },
    });
    return parseImplementationLlmProviderConfigWire(user?.implementationLlmProviderConfigJson);
  } catch {
    return null;
  }
}

function devEnvSyntheticConfig(): ImplementationLlmProviderConfigV1 | null {
  if (!allowEnvOpenAiFallback()) return null;
  const model = parseModelFromEnv() ?? resolveOpenAiModelFromEnv();
  const vision = parseVisionFromEnv() ?? false;
  return {
    version: "implementation_llm_provider_config_v1",
    provider: "openai",
    model,
    scope: "platform",
    capabilities: { text: true, vision, jsonMode: true },
    enabled: true,
  };
}

export async function loadImplementationLlmProviderConfigFromProject(input: Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson?: unknown;
}>): Promise<ImplementationLlmProviderConfigV1 | null> {
  const projectDb = await loadProjectProviderConfigFromDb(input.projectId);
  const stateInline = readInlineConfigFromRequirementsState(input.requirementsStateJson);
  const picked = pickImplementationLlmProviderConfig({ projectDb, stateInline, userDb: null });
  return picked.config;
}

export async function resolveImplementationLlmProviderConfigRecord(input: Readonly<{
  readonly projectId: string;
  readonly actorUserId?: string | null;
  readonly requirementsStateJson?: unknown;
}>): Promise<ImplementationLlmProviderConfigRecord> {
  const projectId = input.projectId.trim();
  const missing: ImplementationLlmProviderConfigRecord = {
    apiKey: null,
    config: null,
    providerSource: "none",
    status: "provider_config_missing",
    envFallback: false,
  };

  if (!projectId) return missing;

  const projectDb = await loadProjectProviderConfigFromDb(projectId);
  const stateInline = readInlineConfigFromRequirementsState(input.requirementsStateJson);

  let setup: {
    openaiPlannerApiKey: string | null;
    project: { ownerUserId: string | null } | null;
  } | null = null;
  try {
    setup = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: { openaiPlannerApiKey: true, project: { select: { ownerUserId: true } } },
    });
  } catch {
    setup = null;
  }

  const ownerId = String(setup?.project?.ownerUserId ?? "").trim();
  const actorId = String(input.actorUserId ?? "").trim();
  const userDb = await loadUserProviderConfigFromDb(ownerId || actorId);

  const picked = pickImplementationLlmProviderConfig({ projectDb, stateInline, userDb });
  let config = picked.config;

  const tryUserKey = async (userId: string): Promise<string | null> => {
    if (!userId) return null;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { defaultOpenaiApiKey: true },
      });
      return String(user?.defaultOpenaiApiKey ?? "").trim() || null;
    } catch {
      return null;
    }
  };

  const projectKey = String(setup?.openaiPlannerApiKey ?? "").trim();

  const resolveKeyForScope = async (): Promise<
    Readonly<{ apiKey: string | null; providerSource: ImplementationLlmProviderConfigRecord["providerSource"] }>
  > => {
    if (picked.scope === "project" && projectKey) {
      return { apiKey: projectKey, providerSource: "project_execution_setup" };
    }
    if (picked.scope === "user") {
      const ownerKey = await tryUserKey(ownerId);
      if (ownerKey) return { apiKey: ownerKey, providerSource: "user_default" };
      if (actorId && actorId !== ownerId) {
        const actorKey = await tryUserKey(actorId);
        if (actorKey) return { apiKey: actorKey, providerSource: "user_default" };
      }
    }
    if (projectKey) return { apiKey: projectKey, providerSource: "project_execution_setup" };
    const ownerKey = await tryUserKey(ownerId);
    if (ownerKey) return { apiKey: ownerKey, providerSource: "user_default" };
    if (actorId && actorId !== ownerId) {
      const actorKey = await tryUserKey(actorId);
      if (actorKey) return { apiKey: actorKey, providerSource: "user_default" };
    }
    const envKey = String(process.env.OPENAI_API_KEY ?? "").trim();
    if (envKey && allowEnvOpenAiFallback()) {
      return { apiKey: envKey, providerSource: "dev_env_fallback" };
    }
    return { apiKey: null, providerSource: "none" };
  };

  const { apiKey, providerSource } = await resolveKeyForScope();
  const envFallback = providerSource === "dev_env_fallback";

  if (!config && apiKey && envFallback) {
    config = devEnvSyntheticConfig();
  }

  if (!apiKey || !config?.model?.trim()) {
    return { ...missing, providerSource, envFallback };
  }

  if (!config && !envFallback) {
    return { ...missing, apiKey: null, providerSource, envFallback: false };
  }

  if (!config) {
    return { ...missing, providerSource, envFallback };
  }

  return {
    apiKey,
    config: {
      ...config,
      scope: picked.scope ?? config.scope ?? "project",
    },
    providerSource,
    status: "ok",
    envFallback,
  };
}

export async function testImplementationLlmProviderConnection(input: Readonly<{
  readonly projectId: string;
  readonly actorUserId?: string | null;
}>): Promise<
  Readonly<{ ok: boolean; message: string; model?: string; providerSource?: string }>
> {
  const resolved = await resolveImplementationLlmProviderConfigRecord({
    projectId: input.projectId,
    actorUserId: input.actorUserId,
  });
  if (resolved.status !== "ok" || !resolved.apiKey || !resolved.config) {
    return { ok: false, message: "Provider 설정 또는 API Key가 없습니다." };
  }
  const { postOpenAiChatCompletionMultimodal } = await import("@/lib/ai/openAiChatMultimodal");
  const res = await postOpenAiChatCompletionMultimodal({
    apiKey: resolved.apiKey,
    model: resolved.config.model,
    temperature: 0,
    maxTokens: 16,
    responseFormatJsonObject: false,
    messages: [{ role: "user", content: "Reply with OK only." }],
  });
  if (!res.ok) {
    return { ok: false, message: res.message ?? "Connection test failed" };
  }
  return {
    ok: true,
    message: "연결 테스트에 성공했습니다.",
    model: resolved.config.model,
    providerSource: resolved.providerSource,
  };
}
