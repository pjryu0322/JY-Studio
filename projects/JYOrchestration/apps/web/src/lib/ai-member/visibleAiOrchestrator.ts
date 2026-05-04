import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";

export { buildWorkspaceAiParticipantOptions } from "@/lib/ai-member/platformAiMembers";

export type VisibleStageKey = "ideation" | "service-flow" | "features" | "tasks" | "prototype";

export const showInternalAgents: boolean = String(process.env.NEXT_PUBLIC_SHOW_INTERNAL_AGENTS ?? "").trim() === "true";

export function displayedWorkspaceAiTitle(memberId: WorkspaceAiMemberId): string {
  return getWorkspaceAiMember(memberId)?.title ?? "AI";
}

export function displayedWorkspaceAiStatusForContext(memberId: WorkspaceAiMemberId): string {
  switch (memberId) {
    case "ideation":
      return "기획 정리 중";
    case "actor_flow":
      return "서비스 흐름 설계 중";
    case "feature_planning":
      return "기능 구조화 중";
    case "prototype_build":
      return "프로토타입 생성 중";
    case "designer":
      return "UI·시각 방향 제안 중";
    case "prototype_review":
      return "프로토타입 검토 중";
    case "security_reviewer":
      return "배포 보안 점검 중";
    case "memo":
      return "메모 지원";
    default: {
      const _e: never = memberId;
      return String(_e);
    }
  }
}

/** @deprecated `displayedWorkspaceAiStatusForContext` + `participantContextKey` 사용 */
export function displayedAiStatusForStage(stage: VisibleStageKey): string {
  switch (stage) {
    case "ideation":
      return displayedWorkspaceAiStatusForContext("ideation");
    case "service-flow":
      return displayedWorkspaceAiStatusForContext("actor_flow");
    case "features":
      return displayedWorkspaceAiStatusForContext("feature_planning");
    case "tasks":
      return "실행 계획 작성 중";
    case "prototype":
      return displayedWorkspaceAiStatusForContext("prototype_build");
    default: {
      const _exhaustive: never = stage;
      return String(_exhaustive);
    }
  }
}

export function visibleStageFromRequirementsStage(stage: string | null | undefined): VisibleStageKey {
  const s = String(stage ?? "").trim();
  if (s === "service-flow") return "service-flow";
  if (s === "features") return "features";
  if (s === "tasks") return "tasks";
  if (s === "prototype" || s === "prototyping" || s === "builder") return "prototype";
  return "ideation";
}
