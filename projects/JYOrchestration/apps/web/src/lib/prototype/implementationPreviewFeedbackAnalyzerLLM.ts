import { invokeImplementationLlmProviderJson } from "@/lib/prototype/implementationLlmProviderGateway";
import { buildImplementationPreviewFeedbackSystemPrompt } from "@/lib/prototype/implementationPreviewFeedbackPrompt";
import {
  buildMinimalPreviewFeedbackFallback,
  parseImplementationPreviewFeedbackAnalysisJson,
  type ImplementationPreviewFeedbackAnalysis,
  type ImplementationPreviewFeedbackAnalyzerInput,
  type ImplementationPreviewFeedbackLlmTrace,
} from "@/lib/prototype/implementationPreviewFeedbackTypes";

function imagePresent(input: ImplementationPreviewFeedbackAnalyzerInput): boolean {
  return Boolean(String(input.imageDataUrl ?? input.imageUrl ?? "").trim());
}

export async function analyzeImplementationPreviewFeedbackWithLlm(
  input: ImplementationPreviewFeedbackAnalyzerInput,
  gatewayInput?: Readonly<{ readonly userId?: string | null }>,
): Promise<
  Readonly<{
    analysis: ImplementationPreviewFeedbackAnalysis;
    trace: ImplementationPreviewFeedbackLlmTrace;
  }>
> {
  const userText = input.userText.trim();
  if (!userText) {
    return {
      analysis: {
        ...buildMinimalPreviewFeedbackFallback(""),
        needsClarification: true,
        clarificationQuestion: "보완 내용을 입력해 주세요.",
        reason: "Empty user text",
      },
      trace: { source: "fallback", reason: "EMPTY_TEXT", usedVision: false },
    };
  }

  const payload = JSON.stringify({
    projectId: input.projectId,
    userText,
    previewUrl: input.previewUrl ?? null,
    captureId: input.captureId ?? null,
    regionCaptureId: input.regionCaptureId ?? null,
    rect: input.rect ?? null,
    recentMessages: input.recentMessages ?? [],
  });

  const res = await invokeImplementationLlmProviderJson({
    projectId: input.projectId,
    userId: gatewayInput?.userId,
    purpose: "implementation_preview_feedback",
    responseFormat: "json",
    requiresVision: imagePresent(input),
    imageDataUrl: input.imageDataUrl,
    imageUrl: input.imageUrl,
    messages: [
      { role: "system", content: buildImplementationPreviewFeedbackSystemPrompt() },
      { role: "user", content: payload },
    ],
  });

  if (!res.ok || !res.parsedJson) {
    return {
      analysis: buildMinimalPreviewFeedbackFallback(userText),
      trace: {
        source: "fallback",
        model: res.model,
        reason: res.trace?.fallbackReason ?? res.errorCode ?? "provider_error",
        usedVision: false,
        providerSource: res.trace?.providerSource,
        fallbackReason: res.trace?.fallbackReason,
      },
    };
  }

  const parsed = parseImplementationPreviewFeedbackAnalysisJson(res.parsedJson);
  if (!parsed) {
    return {
      analysis: buildMinimalPreviewFeedbackFallback(userText),
      trace: {
        source: "fallback",
        model: res.model,
        reason: "VALIDATION",
        usedVision: false,
        providerSource: res.trace?.providerSource,
      },
    };
  }

  const usedVision = res.trace?.usedVision === true;
  let traceReason = parsed.reason;
  if (!usedVision && imagePresent(input)) {
    traceReason = `${parsed.reason} · image_analysis_limited`;
  }

  return {
    analysis: parsed,
    trace: {
      source: usedVision ? "llm_vision" : "llm_text",
      model: res.model,
      reason: traceReason,
      usedVision,
      providerSource: res.trace?.providerSource,
      fallbackReason: res.trace?.fallbackReason,
    },
  };
}
