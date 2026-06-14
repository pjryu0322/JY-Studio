import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { prisma } from "@/lib/prisma";
import type { ImplementationLlmProviderCapabilities } from "@/lib/prototype/implementationLlmProviderTypes";

export type ImplementationLlmProviderConfigV1 = Readonly<{
  readonly version?: "implementation_llm_provider_config_v1";
  readonly provider?: "openai" | string;
  readonly model: string;
  readonly capabilities: ImplementationLlmProviderCapabilities & { readonly jsonMode?: boolean };
  readonly scope?: "project" | "user" | "platform";
}>;

function allowEnvOpenAiFallback(): boolean {
  return String(process.env.NODE_ENV ?? "").trim() !== "production";
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

function readProviderConfigFromRequirementsState(projectId: string): ImplementationLlmProviderConfigV1 | null {
  // Future: load requirementsStateJson row from DB. For gateway calls, caller may pass config via extended context later.
  void projectId;
  return null;
}

export async function loadImplementationLlmProviderConfigFromProject(input: Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson?: unknown;
}>): Promise<ImplementationLlmProviderConfigV1 | null> {
  const fromState = (() => {
    if (!input.requirementsStateJson) return null;
    try {
      const o = readRequirementsStateRoot(input.requirementsStateJson);
      if (!o) return null;
      const raw = o.implementationLlmProviderConfigV1;
      if (!raw || typeof raw !== "object") return null;
      const cfg = raw as Record<string, unknown>;
      const model = typeof cfg.model === "string" ? cfg.model.trim() : "";
      const caps = cfg.capabilities;
      if (!model || !caps || typeof caps !== "object") return null;
      const c = caps as Record<string, unknown>;
      return {
        version: "implementation_llm_provider_config_v1",
        provider: typeof cfg.provider === "string" ? cfg.provider : "openai",
        model,
        capabilities: {
          text: c.text !== false,
          vision: c.vision === true,
          ...(c.jsonMode === true ? { jsonMode: true } : {}),
        },
        scope: "project",
      } satisfies ImplementationLlmProviderConfigV1;
    } catch {
      return null;
    }
  })();
  if (fromState) return fromState;
  return readProviderConfigFromRequirementsState(input.projectId);
}

export async function resolveImplementationLlmProviderConfigRecord(input: Readonly<{
  readonly projectId: string;
  readonly actorUserId?: string | null;
  readonly requirementsStateJson?: unknown;
}>): Promise<
  Readonly<{
    apiKey: string | null;
    config: ImplementationLlmProviderConfigV1 | null;
    providerSource: "project_execution_setup" | "user_default" | "dev_env_fallback" | "none";
  }>
> {
  const projectId = input.projectId.trim();
  const stateConfig = await loadImplementationLlmProviderConfigFromProject({
    projectId,
    requirementsStateJson: input.requirementsStateJson,
  });

  const platformModel = parseModelFromEnv();
  const platformVision = parseVisionFromEnv();

  const defaultCapabilities: ImplementationLlmProviderCapabilities = {
    text: true,
    vision: platformVision ?? false,
  };

  const buildConfig = (
    scope: ImplementationLlmProviderConfigV1["scope"],
    modelOverride: string | null,
    visionOverride: boolean | null,
  ): ImplementationLlmProviderConfigV1 => ({
    provider: stateConfig?.provider ?? "openai",
    model: stateConfig?.model ?? modelOverride ?? platformModel ?? resolveOpenAiModelFromEnv(),
    capabilities: {
      text: stateConfig?.capabilities.text ?? true,
      vision: stateConfig?.capabilities.vision ?? visionOverride ?? platformVision ?? false,
      ...(stateConfig?.capabilities.jsonMode ? { jsonMode: true } : { jsonMode: true }),
    },
    scope: stateConfig?.scope ?? scope,
    version: "implementation_llm_provider_config_v1",
  });

  if (!projectId) {
    return { apiKey: null, config: null, providerSource: "none" };
  }

  let setup: { openaiPlannerApiKey: string | null; project: { ownerUserId: string | null } | null } | null = null;
  try {
    setup = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: { openaiPlannerApiKey: true, project: { select: { ownerUserId: true } } },
    });
  } catch {
    setup = null;
  }

  const projectKey = String(setup?.openaiPlannerApiKey ?? "").trim();
  if (projectKey) {
    return {
      apiKey: projectKey,
      config: buildConfig("project", null, null),
      providerSource: "project_execution_setup",
    };
  }

  const ownerId = String(setup?.project?.ownerUserId ?? "").trim();
  const actorId = String(input.actorUserId ?? "").trim();

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

  const ownerKey = await tryUserKey(ownerId);
  if (ownerKey) {
    return {
      apiKey: ownerKey,
      config: buildConfig("user", null, null),
      providerSource: "user_default",
    };
  }

  if (actorId && actorId !== ownerId) {
    const actorKey = await tryUserKey(actorId);
    if (actorKey) {
      return {
        apiKey: actorKey,
        config: buildConfig("user", null, null),
        providerSource: "user_default",
      };
    }
  }

  const envKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (envKey && allowEnvOpenAiFallback()) {
    return {
      apiKey: envKey,
      config: buildConfig("platform", resolveOpenAiModelFromEnv(), platformVision),
      providerSource: "dev_env_fallback",
    };
  }

  return { apiKey: null, config: buildConfig("platform", null, null), providerSource: "none" };
}
