export type LlmExecutionIntent =
  | "explicit_execute"
  | "ask_advice"
  | "ask_explain"
  | "ask_compare"
  | "ambiguous";

export type LlmActionInvocationStrength = "explicit" | "implicit" | "weak";

export function normalizeLlmExecutionIntent(raw?: string | null): LlmExecutionIntent {
  const v = String(raw ?? "").trim();
  if (
    v === "explicit_execute" ||
    v === "ask_advice" ||
    v === "ask_explain" ||
    v === "ask_compare" ||
    v === "ambiguous"
  ) {
    return v;
  }
  return "ambiguous";
}

export function normalizeLlmActionInvocationStrength(raw?: string | null): LlmActionInvocationStrength {
  const v = String(raw ?? "").trim();
  if (v === "explicit" || v === "implicit" || v === "weak") return v;
  return "weak";
}
