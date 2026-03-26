export const SPEC_WORKSPACE_AI_MODELS = ["gpt-4o", "gpt-4.1", "gpt-4o-mini"] as const;

export type SpecWorkspaceAiModelId = (typeof SPEC_WORKSPACE_AI_MODELS)[number];

export const DEFAULT_SPEC_WORKSPACE_AI_MODEL: SpecWorkspaceAiModelId = "gpt-4o";

export function isAllowedSpecWorkspaceModel(m: string): m is SpecWorkspaceAiModelId {
  return (SPEC_WORKSPACE_AI_MODELS as readonly string[]).includes(m);
}
