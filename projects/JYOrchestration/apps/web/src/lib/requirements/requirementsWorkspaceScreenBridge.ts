import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

export function requirementsWorkspaceStageToScreenKey(stage: RequirementsWorkspaceStage): WorkspaceScreenKey {
  return stage === "service-flow" ? "requirements_service_flow" : "requirements_ideation";
}
