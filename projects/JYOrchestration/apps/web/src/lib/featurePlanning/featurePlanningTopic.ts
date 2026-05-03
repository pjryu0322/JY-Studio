/**
 * 기능 정리 대화 진행 주제(단계별 집중).
 * `FeaturePlanningSlotsArtifactV1.planningTopic`에 저장.
 */
export const FEATURE_PLANNING_TOPICS = [
  "FEATURES",
  "MENU",
  "SCREENS",
  "SCREEN_DETAILS",
  "DATA",
  "TASKS",
] as const;

export type FeaturePlanningTopicV1 = (typeof FEATURE_PLANNING_TOPICS)[number];

const TOPIC_SET = new Set<string>(FEATURE_PLANNING_TOPICS);

export function parsePlanningTopic(raw: unknown): FeaturePlanningTopicV1 | undefined {
  const u = String(raw ?? "").trim().toUpperCase();
  if (!u || !TOPIC_SET.has(u)) return undefined;
  return u as FeaturePlanningTopicV1;
}

export function planningTopicLabelKo(topic: FeaturePlanningTopicV1): string {
  const m: Record<FeaturePlanningTopicV1, string> = {
    FEATURES: "핵심 기능",
    MENU: "메뉴 구조",
    SCREENS: "화면 목록",
    SCREEN_DETAILS: "화면별 기능",
    DATA: "데이터 구조",
    TASKS: "프로토타입 Task",
  };
  return m[topic];
}

/** 사용자에게 보이는 한 줄 안내 */
export function planningTopicInstructionKo(topic: FeaturePlanningTopicV1): string {
  switch (topic) {
    case "FEATURES":
      return "지금은 **핵심 기능**만 다룹니다. 기능 이름 수준의 초안과 짧은 질문만 하세요.";
    case "MENU":
      return "지금은 **메뉴 구조**만 다룹니다. 상단·좌측 메뉴 초안과 짧은 질문만 하세요.";
    case "SCREENS":
      return "지금은 **화면 목록**만 다룹니다. 화면 이름 초안과 짧은 질문만 하세요.";
    case "SCREEN_DETAILS":
      return "지금은 **화면별 기능**만 다룹니다. 화면별로 무엇을 할 수 있는지 초안과 짧은 질문만 하세요.";
    case "DATA":
      return "지금은 **데이터 구조**만 다룹니다. 주요 엔티티·필드 수준 초안과 짧은 질문만 하세요.";
    case "TASKS":
      return "지금은 **프로토타입 Task**만 다룹니다. 구현 단위 작업 초안과 짧은 질문만 하세요.";
    default:
      return "";
  }
}
