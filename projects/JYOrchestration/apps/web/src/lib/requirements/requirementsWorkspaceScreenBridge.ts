import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

export function requirementsWorkspaceStageToScreenKey(stage: RequirementsWorkspaceStage): WorkspaceScreenKey {
  if (stage === "service-flow") return "requirements_service_flow";
  if (stage === "feature-planning") return "feature_planning";
  if (stage === "product-definition") return "requirements_ideation";
  return "requirements_ideation";
}
