import { resolveOpenAiFromEnv } from "@/lib/ai/openAiEnv";
import { buildVisionUserMessage, postOpenAiChatCompletionMultimodal } from "@/lib/ai/openAiChatMultimodal";
import { buildImplementationPreviewFeedbackSystemPrompt } from "@/lib/prototype/implementationPreviewFeedbackPrompt";
import {
  buildMinimalPreviewFeedbackFallback,
  parseImplementationPreviewFeedbackAnalysisJson,
  type ImplementationPreviewFeedbackAnalysis,
  type ImplementationPreviewFeedbackAnalyzerInput,
  type ImplementationPreviewFeedbackLlmTrace,
} from "@/lib/prototype/implementationPreviewFeedbackTypes";

function visionImagePresent(input: ImplementationPreviewFeedbackAnalyzerInput): boolean {
  return Boolean(String(input.imageDataUrl ?? input.imageUrl ?? "").trim());
}

export async function analyzeImplementationPreviewFeedbackWithLlm(
  input: ImplementationPreviewFeedbackAnalyzerInput,
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
      trace: { source: "fallback", reason: "EMPTY_TEXT" },
    };
  }

  const env = resolveOpenAiFromEnv();
  if (!env.ok) {
    return {
      analysis: buildMinimalPreviewFeedbackFallback(userText),
      trace: { source: "fallback", reason: "NO_KEY" },
    };
  }

  const system = buildImplementationPreviewFeedbackSystemPrompt();
  const payload = JSON.stringify({
    projectId: input.projectId,
    userText,
    previewUrl: input.previewUrl ?? null,
    captureId: input.captureId ?? null,
    regionCaptureId: input.regionCaptureId ?? null,
    rect: input.rect ?? null,
    recentMessages: input.recentMessages ?? [],
  });

  const hasVision = visionImagePresent(input);
  const res = hasVision
    ? await postOpenAiChatCompletionMultimodal({
        apiKey: env.apiKey,
        model: env.model,
        temperature: 0.15,
        maxTokens: 700,
        responseFormatJsonObject: true,
        messages: [
          { role: "system", content: system },
          buildVisionUserMessage({
            textPayload: payload,
            imageDataUrl: input.imageDataUrl,
            imageUrl: input.imageUrl,
          }),
        ],
      })
    : await postOpenAiChatCompletionMultimodal({
        apiKey: env.apiKey,
        model: env.model,
        temperature: 0.15,
        maxTokens: 700,
        responseFormatJsonObject: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${payload}\n\n(note: image not sent — text-only analysis)` },
        ],
      });

  if (!res.ok) {
    return {
      analysis: buildMinimalPreviewFeedbackFallback(userText),
      trace: { source: "fallback", model: env.model, reason: res.code },
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(res.text);
  } catch {
    return {
      analysis: buildMinimalPreviewFeedbackFallback(userText),
      trace: { source: "fallback", model: env.model, reason: "PARSE" },
    };
  }

  const parsed = parseImplementationPreviewFeedbackAnalysisJson(raw);
  if (!parsed) {
    return {
      analysis: buildMinimalPreviewFeedbackFallback(userText),
      trace: { source: "fallback", model: env.model, reason: "VALIDATION" },
    };
  }

  return {
    analysis: parsed,
    trace: {
      source: hasVision ? "llm_vision" : "llm_text",
      model: env.model,
      reason: parsed.reason,
    },
  };
}
