import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { OrchestrationMode, WorkspaceSingleChatMode } from "@/lib/requirements/workspaceSingleChatMode";

export type ModeOrchestrationConfig = Readonly<{
  readonly mode: OrchestrationMode;
  readonly primaryMembers: readonly WorkspaceAiMemberId[];
  readonly contextBuilder: string;
  readonly proposalBuilder: string;
  readonly readinessEvaluator: string;
  readonly nextActions: readonly string[];
}>;

export const PLANNING_MODE_PRIMARY_MEMBERS: readonly WorkspaceAiMemberId[] = [
  "ideation",
  "actor_flow",
  "feature_planning",
  "designer",
];

/** 구현 단계 주도 멤버 — `memo`는 SCM(연결·환경) 역할 */
export const IMPLEMENTATION_MODE_PRIMARY_MEMBERS: readonly WorkspaceAiMemberId[] = [
  "prototype_build",
  "prototype_review",
  "security_reviewer",
  "memo",
];

const PLANNING_CONFIG: ModeOrchestrationConfig = {
  mode: "planning",
  primaryMembers: PLANNING_MODE_PRIMARY_MEMBERS,
  contextBuilder: "planningContext",
  proposalBuilder: "planningMemberProposal",
  readinessEvaluator: "planningReadiness",
  nextActions: ["다음 단계 진행", "세부 기능 정리", "화면 구성 보기"],
};

const IMPLEMENTATION_CONFIG: ModeOrchestrationConfig = {
  mode: "implementation",
  primaryMembers: IMPLEMENTATION_MODE_PRIMARY_MEMBERS,
  contextBuilder: "implementationContext",
  proposalBuilder: "implementationMemberProposal",
  readinessEvaluator: "implementationReadiness",
  nextActions: [
    "구현 작업안 확정",
    "역할별 점검 보기",
    "코드 에이전트 WIP 작업 요청",
    "구현 실행 준비",
    "환경설정 열기",
    "구현 범위 수정",
    "산출물 다시 보기",
    "구현 실행",
  ],
};

export function resolveModeOrchestrationConfig(mode: WorkspaceSingleChatMode): ModeOrchestrationConfig {
  return mode === "implementation" ? IMPLEMENTATION_CONFIG : PLANNING_CONFIG;
}
