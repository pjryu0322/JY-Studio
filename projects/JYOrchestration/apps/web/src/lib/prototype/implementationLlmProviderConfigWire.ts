import type { ImplementationLlmProviderCapabilities } from "@/lib/prototype/implementationLlmProviderTypes";

export type ImplementationLlmProviderApiKeyRef =
  | "user_default_openai"
  | "project_openai_planner"
  | string;

export type ImplementationLlmProviderConfigV1 = Readonly<{
  readonly version?: "implementation_llm_provider_config_v1";
  readonly provider?: "openai" | string;
  readonly model: string;
  readonly scope?: "project" | "user" | "platform";
  /** Credential location — never store plaintext API keys in this JSON. */
  readonly apiKeyRef?: ImplementationLlmProviderApiKeyRef;
  readonly capabilities: ImplementationLlmProviderCapabilities & { readonly jsonMode?: boolean };
  readonly enabled?: boolean;
  readonly updatedAt?: string;
}>;

export type ImplementationLlmProviderTestResponse = Readonly<{
  readonly success: boolean;
  readonly message: string;
  readonly errorCode?: string;
  readonly data?: Readonly<{
    readonly provider: string;
    readonly model: string;
    readonly capabilities: Readonly<{
      readonly text: boolean;
      readonly vision: boolean;
      readonly jsonMode?: boolean;
    }>;
    readonly trace?: Readonly<{
      readonly usedEnvFallback: boolean;
      readonly capabilitySource: "provider_config";
    }>;
    readonly providerSource?: string;
  }>;
}>;

function stripPlaintextSecretsFromConfigInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  delete o.apiKey;
  delete o.encryptedApiKey;
  delete o.openaiApiKey;
  delete o.defaultOpenaiApiKey;
  return o;
}

export function parseImplementationLlmProviderConfigWire(raw: unknown): ImplementationLlmProviderConfigV1 | null {
  const cleaned = stripPlaintextSecretsFromConfigInput(raw);
  if (!cleaned || typeof cleaned !== "object") return null;
  const cfg = cleaned as Record<string, unknown>;
  const model = typeof cfg.model === "string" ? cfg.model.trim() : "";
  const caps = cfg.capabilities;
  if (!model || !caps || typeof caps !== "object") return null;
  const c = caps as Record<string, unknown>;
  const enabled = cfg.enabled === false ? false : true;
  if (!enabled) return null;
  return {
    version: "implementation_llm_provider_config_v1",
    provider: typeof cfg.provider === "string" ? cfg.provider.trim() || "openai" : "openai",
    model,
    scope:
      cfg.scope === "user" || cfg.scope === "project" || cfg.scope === "platform"
        ? cfg.scope
        : undefined,
    capabilities: {
      text: c.text !== false,
      vision: c.vision === true,
      ...(c.jsonMode === true ? { jsonMode: true } : {}),
    },
    enabled: true,
    ...(typeof cfg.apiKeyRef === "string" && cfg.apiKeyRef.trim()
      ? { apiKeyRef: cfg.apiKeyRef.trim() as ImplementationLlmProviderApiKeyRef }
      : {}),
    ...(typeof cfg.updatedAt === "string" ? { updatedAt: cfg.updatedAt } : {}),
  };
}

export function sanitizeImplementationLlmProviderConfigForApi(
  config: ImplementationLlmProviderConfigV1 | null | undefined,
): ImplementationLlmProviderConfigV1 | null {
  if (!config) return null;
  return {
    version: config.version ?? "implementation_llm_provider_config_v1",
    provider: config.provider ?? "openai",
    model: config.model,
    scope: config.scope,
    capabilities: {
      text: config.capabilities.text !== false,
      vision: config.capabilities.vision === true,
      ...(config.capabilities.jsonMode ? { jsonMode: true } : {}),
    },
    enabled: config.enabled !== false,
    ...(config.apiKeyRef ? { apiKeyRef: config.apiKeyRef } : {}),
    ...(config.updatedAt ? { updatedAt: config.updatedAt } : {}),
  };
}

/** Project DB > inline state > user DB */
export function pickImplementationLlmProviderConfig(input: Readonly<{
  readonly projectDb: ImplementationLlmProviderConfigV1 | null;
  readonly stateInline: ImplementationLlmProviderConfigV1 | null;
  readonly userDb: ImplementationLlmProviderConfigV1 | null;
}>): Readonly<{ config: ImplementationLlmProviderConfigV1 | null; scope: "project" | "user" | null }> {
  if (input.projectDb) return { config: input.projectDb, scope: "project" };
  if (input.stateInline) return { config: { ...input.stateInline, scope: "project" }, scope: "project" };
  if (input.userDb) return { config: input.userDb, scope: "user" };
  return { config: null, scope: null };
}

export function isProductionNodeEnv(nodeEnv: string | undefined): boolean {
  return String(nodeEnv ?? "").trim() === "production";
}
