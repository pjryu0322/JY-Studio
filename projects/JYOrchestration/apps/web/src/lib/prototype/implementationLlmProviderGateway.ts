import {
  buildVisionUserMessage,
  postOpenAiChatCompletionMultimodal,
  type OpenAiMultimodalMessage,
} from "@/lib/ai/openAiChatMultimodal";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { resolveLlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
import {
  modelSupportsVision,
  type ImplementationLlmProviderConfig,
  type ImplementationLlmProviderRequest,
  type ImplementationLlmProviderResponse,
} from "@/lib/prototype/implementationLlmProviderTypes";

export async function resolveImplementationLlmProviderConfig(input: Readonly<{
  readonly projectId: string;
  readonly userId?: string | null;
}>): Promise<ImplementationLlmProviderConfig | null> {
  const ctx = await resolveLlmCodeTaskRefinementProviderContext({
    projectId: input.projectId,
    actorUserId: input.userId ?? null,
  });
  const apiKey = String(ctx.apiKey ?? "").trim();
  if (!apiKey) return null;
  const model = String(ctx.model ?? resolveOpenAiModelFromEnv()).trim() || resolveOpenAiModelFromEnv();
  const source = ctx.providerSource ?? "none";
  const providerSource =
    source === "env_fallback"
      ? ("dev_env_fallback" as const)
      : (source as ImplementationLlmProviderConfig["providerSource"]);
  return {
    provider: "openai",
    model,
    apiKey,
    capabilities: {
      text: true,
      vision: modelSupportsVision(model),
    },
    providerSource,
  };
}

function appendVisionNote(content: string, note: string): OpenAiMultimodalMessage {
  return { role: "user", content: `${content}\n\n(${note})` };
}

export async function invokeImplementationLlmProviderJson(
  request: ImplementationLlmProviderRequest,
): Promise<ImplementationLlmProviderResponse> {
  const config = await resolveImplementationLlmProviderConfig({
    projectId: request.projectId,
    userId: request.userId,
  });

  if (!config) {
    return {
      ok: false,
      provider: "none",
      model: resolveOpenAiModelFromEnv(),
      capabilities: { text: false, vision: false },
      errorCode: "NO_PROVIDER",
      errorMessage: "LLM provider config not available for project",
      trace: { usedVision: false, providerSource: "none", fallbackReason: "no_provider" },
    };
  }

  const imagePresent = Boolean(String(request.imageDataUrl ?? request.imageUrl ?? "").trim());
  const canUseVision =
    request.requiresVision === true &&
    imagePresent &&
    config.capabilities.vision === true;

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
        appendVisionNote(base, "image_analysis_limited: provider vision not supported — text metadata only"),
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
    maxTokens: request.purpose === "implementation_intent_resolver" ? 650 : 750,
    responseFormatJsonObject: true,
    messages,
  });

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
        providerSource: config.providerSource,
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
      providerSource: config.providerSource,
      ...(!canUseVision && imagePresent && request.requiresVision
        ? { fallbackReason: "provider_vision_not_supported" }
        : {}),
    },
  };
}
