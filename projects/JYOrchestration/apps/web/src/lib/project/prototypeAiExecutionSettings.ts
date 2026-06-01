import type { ExecutionSetupDto } from "@/components/project-spec/api";
import { secretMaskedDisplay } from "@/components/project-spec/credentialUiMask";

export type AiExecutionSettingsDraft = Readonly<{
  enableLlmCodeTaskRefinement: boolean;
  openaiPlannerApiKeyInput: string;
  openaiPlannerApiKeyPendingDelete: boolean;
}>;

export function openaiPlannerCredentialLooksStored(
  es: { hasOpenaiPlannerApiKey?: boolean; openaiPlannerApiKeyMasked?: string | null } | null | undefined
): boolean {
  if (!es) return false;
  if (es.hasOpenaiPlannerApiKey === true) return true;
  return Boolean(String(es.openaiPlannerApiKeyMasked ?? "").trim());
}

export function syncEnableLlmCodeTaskRefinementFromSetup(
  setup: ExecutionSetupDto | null | undefined
): boolean {
  return setup?.enableLlmCodeTaskRefinement === true;
}

export function resolvePlannerKeyUiState(input: {
  readonly executionSetup: ExecutionSetupDto | null | undefined;
  readonly pendingDelete: boolean;
}): Readonly<{ hasKey: boolean; masked: string; statusLabel: "설정됨" | "미설정" }> {
  const stored = openaiPlannerCredentialLooksStored(input.executionSetup);
  const hasKey = stored && !input.pendingDelete;
  const masked = secretMaskedDisplay(
    input.executionSetup?.openaiPlannerApiKeyMasked ?? null,
    null,
    hasKey
  );
  return {
    hasKey,
    masked,
    statusLabel: hasKey ? "설정됨" : "미설정",
  };
}

export function buildMvpAiExecutionSettingsPatch(
  draft: AiExecutionSettingsDraft
): Readonly<{ enableLlmCodeTaskRefinement: boolean; openaiPlannerApiKey?: string | null }> {
  const patch: { enableLlmCodeTaskRefinement: boolean; openaiPlannerApiKey?: string | null } = {
    enableLlmCodeTaskRefinement: draft.enableLlmCodeTaskRefinement,
  };
  if (draft.openaiPlannerApiKeyPendingDelete) {
    patch.openaiPlannerApiKey = null;
  } else {
    const trimmed = draft.openaiPlannerApiKeyInput.trim();
    if (trimmed) patch.openaiPlannerApiKey = trimmed;
  }
  return patch;
}

export function llmRefinementStatusLabel(enabled: boolean): "사용" | "미사용" {
  return enabled ? "사용" : "미사용";
}
