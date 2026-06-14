import {
  buildVisionUserMessage,
  postOpenAiChatCompletionMultimodal,
  type OpenAiMultimodalMessage,
} from "@/lib/ai/openAiChatMultimodal";
import { resolveImplementationLlmProviderConfigRecord } from "@/lib/prototype/implementationLlmProviderConfig.server";
import {
  IMPLEMENTATION_LLM_PROVIDER_CONFIG_MISSING_MESSAGE,
  IMPLEMENTATION_LLM_PROVIDER_GATEWAY_ERROR_CODE,
} from "@/lib/prototype/implementationLlmProviderMessages";
import type {
  ImplementationLlmProviderConfig,
  ImplementationLlmProviderRequest,
  ImplementationLlmProviderResponse,
} from "@/lib/prototype/implementationLlmProviderTypes";

export async function resolveImplementationLlmProviderConfig(input: Readonly<{
  readonly projectId: string;
  readonly userId?: string | null;
  readonly requirementsStateJson?: unknown;
}>): Promise<ImplementationLlmProviderConfig | null> {
  const resolved = await resolveImplementationLlmProviderConfigRecord({
    projectId: input.projectId,
    actorUserId: input.userId ?? null,
    requirementsStateJson: input.requirementsStateJson,
  });
  if (resolved.status !== "ok") return null;
  const apiKey = String(resolved.apiKey ?? "").trim();
  if (!apiKey || !resolved.config) return null;
  return {
    provider: resolved.config.provider ?? "openai",
    model: resolved.config.model,
    apiKey,
    capabilities: {
      text: resolved.config.capabilities.text !== false,
      vision: resolved.config.capabilities.vision === true,
    },
    providerSource: resolved.providerSource,
  };
}

function appendVisionNote(content: string, note: string): OpenAiMultimodalMessage {
  return { role: "user", content: `${content}\n\n(${note})` };
}

function providerMissingResponse(
  resolved: Awaited<ReturnType<typeof resolveImplementationLlmProviderConfigRecord>>,
): ImplementationLlmProviderResponse {
  return {
    ok: false,
    provider: "none",
    model: resolved.config?.model ?? "",
    capabilities: { text: false, vision: false },
    errorCode: IMPLEMENTATION_LLM_PROVIDER_GATEWAY_ERROR_CODE,
    errorMessage: IMPLEMENTATION_LLM_PROVIDER_CONFIG_MISSING_MESSAGE,
    trace: {
      usedVision: false,
      providerSource: resolved.providerSource,
      fallbackReason: "provider_config_missing",
      capabilitySource: "provider_config",
      envFallback: resolved.envFallback,
    },
  };
}

export async function invokeImplementationLlmProviderJson(
  request: ImplementationLlmProviderRequest,
): Promise<ImplementationLlmProviderResponse> {
  const resolved = await resolveImplementationLlmProviderConfigRecord({
    projectId: request.projectId,
    actorUserId: request.userId ?? null,
    requirementsStateJson: request.requirementsStateJson,
  });

  if (resolved.status !== "ok") {
    return providerMissingResponse(resolved);
  }

  const config = await resolveImplementationLlmProviderConfig({
    projectId: request.projectId,
    userId: request.userId,
    requirementsStateJson: request.requirementsStateJson,
  });

  if (!config) {
    return providerMissingResponse(resolved);
  }

  const imagePresent = Boolean(String(request.imageDataUrl ?? request.imageUrl ?? "").trim());
  const canUseVision =
    request.requiresVision === true && imagePresent && config.capabilities.vision === true;

  let messages: readonly OpenAiMultimodalMessage[] = request.messages;
  if (request.requiresVision && imagePresent && !canUseVision) {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const base =
        typeof last.content === "string"
          ? last.content
          : last.content
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("\n");
      messages = [
        ...messages.slice(0, -1),
        appendVisionNote(
          base,
          config.capabilities.vision
            ? "image_analysis_limited: image_missing"
            : "image_analysis_limited: provider_vision_not_supported — text metadata only",
        ),
      ];
    }
  } else if (canUseVision) {
    const last = messages[messages.length - 1];
    if (last?.role === "user" && typeof last.content === "string") {
      messages = [
        ...messages.slice(0, -1),
        buildVisionUserMessage({
          textPayload: last.content,
          imageDataUrl: request.imageDataUrl,
          imageUrl: request.imageUrl,
        }),
      ];
    }
  }

  const res = await postOpenAiChatCompletionMultimodal({
    apiKey: config.apiKey,
    model: config.model,
    temperature: 0.12,
    maxTokens:
      request.purpose === "implementation_code_task_refinement"
        ? 2048
        : request.purpose === "implementation_intent_resolver"
          ? 650
          : 750,
    responseFormatJsonObject: true,
    messages,
  });

  const traceBase = {
    providerSource: config.providerSource,
    capabilitySource: "provider_config" as const,
    envFallback: resolved.envFallback,
  };

  if (!res.ok) {
    return {
      ok: false,
      provider: config.provider,
      model: config.model,
      capabilities: config.capabilities,
      errorCode: res.code,
      errorMessage: res.message,
      trace: {
        usedVision: false,
        ...traceBase,
        fallbackReason: res.code,
      },
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(res.text);
  } catch {
    parsedJson = undefined;
  }

  return {
    ok: true,
    provider: config.provider,
    model: config.model,
    capabilities: config.capabilities,
    content: res.text,
    parsedJson,
    trace: {
      usedVision: canUseVision,
      ...traceBase,
      ...(!canUseVision && imagePresent && request.requiresVision
        ? {
            fallbackReason: config.capabilities.vision ? "image_missing" : "provider_vision_not_supported",
          }
        : {}),
    },
  };
}
