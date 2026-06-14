import { invokeImplementationLlmProviderJson } from "@/lib/prototype/implementationLlmProviderGateway";
import { buildImplementationIntentResolverSystemPrompt } from "@/lib/prototype/implementationIntentResolverPrompt";
import {
  parseImplementationIntentResolverJson,
  type ImplementationIntentResolverInput,
  type ImplementationIntentResolverLlmTrace,
  type ImplementationIntentResolverResult,
} from "@/lib/prototype/implementationIntentResolverTypes";

export async function resolveImplementationIntentWithLlm(
  input: ImplementationIntentResolverInput,
  gatewayInput?: Readonly<{ readonly userId?: string | null; readonly requirementsStateJson?: unknown }>,
): Promise<
  Readonly<{
    result: ImplementationIntentResolverResult;
    trace: ImplementationIntentResolverLlmTrace;
  }>
> {
  const res = await invokeImplementationLlmProviderJson({
    projectId: input.projectId,
    userId: gatewayInput?.userId,
    requirementsStateJson: gatewayInput?.requirementsStateJson,
    purpose: "implementation_intent_resolver",
    responseFormat: "json",
    messages: [
      { role: "system", content: buildImplementationIntentResolverSystemPrompt() },
      { role: "user", content: JSON.stringify(input) },
    ],
  });

  if (!res.ok || !res.parsedJson) {
    return {
      result: {
        intent: "none",
        confidence: "low",
        reason: res.errorMessage ?? "LLM provider unavailable",
      },
      trace: {
        source: "fallback",
        model: res.model,
        reason: res.trace?.fallbackReason ?? res.errorCode ?? "provider_error",
        providerSource: res.trace?.providerSource,
      },
    };
  }

  const parsed = parseImplementationIntentResolverJson(res.parsedJson);
  if (!parsed) {
    return {
      result: { intent: "none", confidence: "low", reason: "Intent schema validation failed" },
      trace: { source: "fallback", model: res.model, reason: "VALIDATION", providerSource: res.trace?.providerSource },
    };
  }

  return {
    result: parsed,
    trace: {
      source: "llm",
      model: res.model,
      reason: parsed.reason,
      providerSource: res.trace?.providerSource,
    },
  };
}
