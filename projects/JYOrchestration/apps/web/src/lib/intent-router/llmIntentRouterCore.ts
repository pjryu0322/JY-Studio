import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiFromEnv } from "@/lib/ai/openAiEnv";
import {
  normalizeLlmActionInvocationStrength,
  normalizeLlmExecutionIntent,
  type LlmActionInvocationStrength,
  type LlmExecutionIntent,
} from "@/lib/intent-router/llmIntentRouterTypes";

export type LlmIntentRouterCoreParsed<TActionId extends string> = Readonly<{
  intentType: string;
  suggestedActionId: TActionId | null;
  confidence: number;
  reason?: string;
  clarificationQuestion?: string;
  executionIntent: LlmExecutionIntent;
  actionInvocationStrength: LlmActionInvocationStrength;
}>;

export type LlmIntentRouterCoreInput<TActionId extends string> = Readonly<{
  systemPrompt: string;
  userPayload: unknown;
  pickableActionIds: readonly TActionId[];
  isPickableActionId: (id: string) => id is TActionId;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}>;

export type LlmIntentRouterCoreResult<TActionId extends string> =
  | Readonly<{
      ok: true;
      model: string;
      promptText: string;
      rawText: string;
      parsed: LlmIntentRouterCoreParsed<TActionId>;
    }>
  | Readonly<{
      ok: false;
      code: string;
      message: string;
    }>;

export function parseLlmIntentRouterJson<TActionId extends string>(
  text: string,
  pickable: readonly TActionId[],
  isPickableActionId: (id: string) => id is TActionId,
): LlmIntentRouterCoreParsed<TActionId> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const suggestedRaw = o.suggestedActionId;
  const suggestedActionId =
    suggestedRaw === null || suggestedRaw === undefined || suggestedRaw === ""
      ? null
      : isPickableActionId(String(suggestedRaw)) && pickable.includes(String(suggestedRaw) as TActionId)
        ? (String(suggestedRaw) as TActionId)
        : null;
  const confidenceNum = Number(o.confidence);
  const confidence = Number.isFinite(confidenceNum) ? Math.min(1, Math.max(0, confidenceNum)) : 0;
  return {
    intentType: String(o.intentType ?? "unknown").trim() || "unknown",
    suggestedActionId,
    confidence,
    reason: typeof o.reason === "string" ? o.reason.trim().slice(0, 400) : undefined,
    clarificationQuestion:
      typeof o.clarificationQuestion === "string" ? o.clarificationQuestion.trim().slice(0, 500) : undefined,
    executionIntent: normalizeLlmExecutionIntent(
      typeof o.executionIntent === "string" ? o.executionIntent : undefined,
    ),
    actionInvocationStrength: normalizeLlmActionInvocationStrength(
      typeof o.actionInvocationStrength === "string" ? o.actionInvocationStrength : undefined,
    ),
  };
}

export async function runLlmIntentRouterCore<TActionId extends string>(
  input: LlmIntentRouterCoreInput<TActionId>,
): Promise<LlmIntentRouterCoreResult<TActionId>> {
  const env = resolveOpenAiFromEnv();
  if (!env.ok) {
    return { ok: false, code: "NO_KEY", message: env.message };
  }

  const system = input.systemPrompt;
  const user = JSON.stringify(input.userPayload, null, 0);
  const promptText = `${system}\n\n---\n\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey: env.apiKey,
    model: input.model ?? env.model,
    temperature: input.temperature ?? 0.1,
    maxTokens: input.maxTokens ?? 500,
    responseFormatJsonObject: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message };
  }

  const parsed = parseLlmIntentRouterJson(res.text, input.pickableActionIds, input.isPickableActionId);
  if (!parsed) {
    return { ok: false, code: "PARSE", message: "LLM intent JSON parse failed" };
  }

  return { ok: true, model: env.model, promptText, rawText: res.text, parsed };
}
