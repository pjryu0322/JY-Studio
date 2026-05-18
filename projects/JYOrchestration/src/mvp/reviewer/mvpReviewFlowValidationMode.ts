/**
 * MVP — **target** flow validation mode markers (prompt-string based; preparation for future structured options).
 *
 * `resolveFlowValidationModeExplicit` is the forward path when callers pass flags instead of
 * embedding `Flow validation: ON` in prompt text. `reviewTaskResult` still uses substring detection today.
 */

export const MVP_FLOW_CONTEXT_BLOCK_HEADER = "### Flow context (preparation only)" as const;
export const MVP_FLOW_VALIDATION_ON_MARKER = "Flow validation: ON" as const;
export const MVP_FLOW_VALIDATION_OFF_MARKER = "Flow validation: OFF" as const;

/**
 * How flow validation is activated today vs future explicit wiring (no behavior change until callers opt in).
 */
export type MvpFlowValidationModeSource = "prompt_substrings" | "explicit";

export type MvpResolvedFlowValidationMode =
  | {
      source: "prompt_substrings";
      hasFlowContextBlock: boolean;
      /** True when the prompt requests strict flow checks (`Flow validation: ON` substring present). */
      validationEnabled: boolean;
    }
  | {
      source: "explicit";
      /** Reserved for future non-prompt configuration; not used by `reviewTaskResult` yet. */
      validationEnabled: boolean;
      hasFlowContextBlock: boolean;
    };

/** Prompt-string fallback: detects flow block header + ON marker without changing substring semantics. */
export function resolveFlowValidationModeFromPrompt(prompt: string): MvpResolvedFlowValidationMode {
  return {
    source: "prompt_substrings",
    hasFlowContextBlock: prompt.includes(MVP_FLOW_CONTEXT_BLOCK_HEADER),
    validationEnabled: prompt.includes(MVP_FLOW_VALIDATION_ON_MARKER),
  };
}

/**
 * Coarse ON/OFF gate for strict flow validation (substring-based today).
 * `"ON"` iff flow context block is present **and** `Flow validation: ON` appears in the prompt.
 */
export function resolveFlowValidationMode(prompt: string): "ON" | "OFF" {
  const m = resolveFlowValidationModeFromPrompt(prompt);
  return m.hasFlowContextBlock && m.validationEnabled ? "ON" : "OFF";
}

/** Future explicit wiring (e.g. options object) — not used by `reviewTaskResult` today. */
export function resolveFlowValidationModeExplicit(input: {
  hasFlowContextBlock: boolean;
  validationEnabled: boolean;
}): MvpResolvedFlowValidationMode {
  return { source: "explicit", ...input };
}

