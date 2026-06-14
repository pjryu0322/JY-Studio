import type { ImplementationLlmProviderCapabilities } from "@/lib/prototype/implementationLlmProviderTypes";

export type ImplementationLlmProviderConfigV1 = Readonly<{
  readonly version?: "implementation_llm_provider_config_v1";
  readonly provider?: "openai" | string;
  readonly model: string;
  readonly scope?: "project" | "user" | "platform";
  readonly capabilities: ImplementationLlmProviderCapabilities & { readonly jsonMode?: boolean };
  readonly enabled?: boolean;
  readonly updatedAt?: string;
}>;

export function parseImplementationLlmProviderConfigWire(raw: unknown): ImplementationLlmProviderConfigV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as Record<string, unknown>;
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
