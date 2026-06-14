import { resolveImplementationLlmProviderConfigRecord } from "@/lib/prototype/implementationLlmProviderConfig.server";

export type LlmCodeTaskRefinementProviderContext = Readonly<{
  readonly apiKey?: string | null;
  readonly model?: string | null;
  readonly providerSource?:
    | "project_execution_setup"
    | "user_default"
    | "dev_env_fallback"
    | "env_fallback"
    | "none";
  readonly projectId?: string;
  readonly actorUserId?: string | null;
  readonly configStatus?: "ok" | "provider_config_missing";
  readonly envFallback?: boolean;
}>;

function mapProviderSource(
  source: Awaited<ReturnType<typeof resolveImplementationLlmProviderConfigRecord>>["providerSource"],
): LlmCodeTaskRefinementProviderContext["providerSource"] {
  if (source === "dev_env_fallback") return "env_fallback";
  return source;
}

export async function resolveLlmCodeTaskRefinementProviderContext(input: {
  readonly projectId: string;
  readonly actorUserId?: string | null;
}): Promise<LlmCodeTaskRefinementProviderContext> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { apiKey: null, model: null, providerSource: "none", configStatus: "provider_config_missing" };
  }

  const resolved = await resolveImplementationLlmProviderConfigRecord({
    projectId,
    actorUserId: input.actorUserId ?? null,
  });

  if (resolved.status !== "ok" || !resolved.apiKey || !resolved.config?.model) {
    return {
      apiKey: null,
      model: resolved.config?.model ?? null,
      providerSource: mapProviderSource(resolved.providerSource),
      projectId,
      actorUserId: input.actorUserId ?? null,
      configStatus: "provider_config_missing",
      envFallback: resolved.envFallback,
    };
  }

  return {
    apiKey: resolved.apiKey,
    model: resolved.config.model,
    providerSource: mapProviderSource(resolved.providerSource),
    projectId,
    actorUserId: input.actorUserId ?? null,
    configStatus: "ok",
    envFallback: resolved.envFallback,
  };
}
