export type AiPlannerPromptMode = "pre_project_brainstorm" | "project_single_chat";

export function resolveAiPlannerPromptMode(input: {
  readonly projectId?: string | null;
  readonly roomId?: string | null;
  readonly layout?: string | null;
}): AiPlannerPromptMode {
  void input.roomId;
  void input.layout;
  return String(input.projectId ?? "").trim() ? "project_single_chat" : "pre_project_brainstorm";
}
