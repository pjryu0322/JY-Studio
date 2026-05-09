import type { AiMember } from "@/lib/messenger/messengerHomeMemberTypes";

/**
 * 메신저 홈 [멤버] → [AI멤버] 탭 표시용 카탈로그(문구·상태는 제품 UX 기준, id는 플랫폼 AI 키와 정렬).
 */
export const MESSENGER_HOME_AI_CATALOG: readonly AiMember[] = [
  {
    id: "ideation",
    name: "AI 기획자",
    category: "기획",
    description: "아이디어를 프로젝트 초안으로 정리하고 목표·범위·산출물을 명확히 합니다.",
    status: "AVAILABLE",
    promptKey: "ideation",
  },
  {
    id: "actor_flow",
    name: "AI 분석가",
    category: "분석",
    description: "액터와 서비스 흐름을 정의하고 요구사항 구조화를 지원합니다.",
    status: "COMING_SOON",
    promptKey: "actor_flow",
  },
  {
    id: "feature_planning",
    name: "AI 설계자",
    category: "설계",
    description: "기능 범위와 체크리스트를 정리하고 설계 기준을 제안합니다.",
    status: "COMING_SOON",
    promptKey: "feature_planning",
  },
  {
    id: "prototype_build",
    name: "AI 개발자",
    category: "구현·프로토타입",
    description: "프로토타입 생성과 실행 계획 수립을 지원합니다.",
    status: "COMING_SOON",
    promptKey: "prototype_build",
  },
  {
    id: "designer",
    name: "AI 디자이너",
    category: "UI·시각",
    description: "레이아웃, 타이포, 색상, 간격, 접근성을 고려한 UI 방향을 제안합니다.",
    status: "COMING_SOON",
    promptKey: "designer",
  },
  {
    id: "prototype_review",
    name: "AI 검수자",
    category: "검토",
    description: "프로토타입 산출물의 누락, 일관성, 개선사항을 검토합니다.",
    status: "COMING_SOON",
    promptKey: "prototype_review",
  },
];

export function aiMemberStatusLabel(status: AiMember["status"]): string {
  return status === "AVAILABLE" ? "사용 가능" : "준비 중";
}
