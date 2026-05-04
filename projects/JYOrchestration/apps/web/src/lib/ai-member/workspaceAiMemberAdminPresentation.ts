import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";

/** 멤버 관리·설명용 — 워크플로 상의 대표 화면(한 줄) */
export const WORKSPACE_AI_MEMBER_PRIMARY_SCREEN: Record<WorkspaceAiMemberId, string> = {
  ideation: "아이디어 구체화",
  actor_flow: "액터 및 서비스 흐름 정의",
  feature_planning: "기능 정리",
  prototype_build: "프로토타입 생성",
  designer: "기능 정리 · 프로토타입 생성",
  prototype_review: "프로토타입 검토",
  security_reviewer: "배포 보안 게이트",
  memo: "작업 메모",
};

export function workspaceAiMemberPrimaryScreenLabel(id: WorkspaceAiMemberId): string {
  return WORKSPACE_AI_MEMBER_PRIMARY_SCREEN[id] ?? id;
}
