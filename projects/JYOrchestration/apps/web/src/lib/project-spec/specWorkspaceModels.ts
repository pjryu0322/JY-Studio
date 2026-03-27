export const SPEC_WORKSPACE_AI_MODELS = ["gpt-4o", "gpt-4.1", "gpt-4o-mini"] as const;

export type SpecWorkspaceAiModelId = (typeof SPEC_WORKSPACE_AI_MODELS)[number];

export const DEFAULT_SPEC_WORKSPACE_AI_MODEL: SpecWorkspaceAiModelId = "gpt-4o";

/** UI 표시용 (미니 모델 구분) */
export const SPEC_WORKSPACE_MODEL_LABELS: Record<SpecWorkspaceAiModelId, string> = {
  "gpt-4o": "GPT-4o",
  "gpt-4.1": "GPT-4.1",
  "gpt-4o-mini": "GPT-4o mini",
};

export function isAllowedSpecWorkspaceModel(m: string): m is SpecWorkspaceAiModelId {
  return (SPEC_WORKSPACE_AI_MODELS as readonly string[]).includes(m);
}
