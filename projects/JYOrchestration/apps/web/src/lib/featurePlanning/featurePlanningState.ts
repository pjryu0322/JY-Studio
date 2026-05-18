import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";

/**
 * v2 프롬프트 블록 7 — 현재 주제별 짧은 행동 지시.
 */
export function currentTaskInstructionForTopic(topic: FeaturePlanningTopicV1): string {
  switch (topic) {
    case "FEATURES":
      return "[4] PLANNER_INPUT+QUESTION_QUEUE. message: 인정→반영→다음 세부 항목 전환 한 문장→질문 1개. [답함] 재질문 금지. answeredFieldIds에 이번에 확정한 큐 id.";
    case "MENU":
      return "메뉴 초안을 제안하고, 사용자가 고를 수 있게 번호를 붙인 뒤 질문 1개만 하세요.";
    case "SCREENS":
      return "필요 화면 목록 초안을 제안하고, 질문 1개만 하세요.";
    case "SCREEN_DETAILS":
      return "우선 화면 1~2개의 상세(주요 입력·버튼·상태)만 정리하고, 질문 1개만 하세요.";
    case "DATA":
      return "주요 엔티티·관계 초안을 제안하고, 질문 1개만 하세요.";
    case "TASKS":
      return "프로토타입 구현 단위 작업 초안을 제안하고, 질문 1개만 하세요.";
    case "DONE":
      return "짧게 마무리 인사와 다음 단계(프로토타입)로 이어질 한 줄만 하세요.";
    default:
      return "현재 단계에 맞게 간결히 응답하세요.";
  }
}
