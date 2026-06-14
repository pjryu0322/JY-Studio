import { resolveOpenAiFromEnv } from "@/lib/ai/openAiEnv";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { buildImplementationIntentResolverSystemPrompt } from "@/lib/prototype/implementationIntentResolverPrompt";
import {
  parseImplementationIntentResolverJson,
  type ImplementationIntentResolverInput,
  type ImplementationIntentResolverLlmTrace,
  type ImplementationIntentResolverResult,
} from "@/lib/prototype/implementationIntentResolverTypes";

export async function resolveImplementationIntentWithLlm(input: ImplementationIntentResolverInput): Promise<
  Readonly<{
    result: ImplementationIntentResolverResult;
    trace: ImplementationIntentResolverLlmTrace;
  }>
> {
  const env = resolveOpenAiFromEnv();
  if (!env.ok) {
    return {
      result: {
        intent: "none",
        confidence: "low",
        reason: env.message,
      },
      trace: { source: "fallback", reason: "NO_KEY" },
    };
  }

  const system = buildImplementationIntentResolverSystemPrompt();
  const userPayload = JSON.stringify(input);
  const res = await postOpenAiChatCompletion({
    apiKey: env.apiKey,
    model: env.model,
    temperature: 0.1,
    maxTokens: 600,
    responseFormatJsonObject: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPayload },
    ],
  });

  if (!res.ok) {
    return {
      result: { intent: "none", confidence: "low", reason: res.message },
      trace: { source: "fallback", model: env.model, reason: res.code },
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(res.text);
  } catch {
    return {
      result: { intent: "none", confidence: "low", reason: "Intent JSON parse failed" },
      trace: { source: "fallback", model: env.model, reason: "PARSE" },
    };
  }

  const parsed = parseImplementationIntentResolverJson(raw);
  if (!parsed) {
    return {
      result: { intent: "none", confidence: "low", reason: "Intent schema validation failed" },
      trace: { source: "fallback", model: env.model, reason: "VALIDATION" },
    };
  }

  return {
    result: parsed,
    trace: { source: "llm", model: env.model, reason: parsed.reason },
  };
}
