import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { resolveParticipantContextKey } from "@/components/workspace/useWorkspaceParticipants";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";

export function pickWorkspaceAiHandoffMember(
  stage: RequirementsWorkspaceStage,
  ids: readonly WorkspaceAiMemberId[]
): WorkspaceAiMemberId {
  if (!ids.length) return resolveParticipantContextKey(stage);
  if (stage === "service-flow" && ids.includes("actor_flow")) return "actor_flow";
  if (stage === "ideation" && ids.includes("ideation")) return "ideation";
  if (stage === "feature-planning" && ids.includes("feature_planning")) return "feature_planning";
  return ids[0]!;
}
