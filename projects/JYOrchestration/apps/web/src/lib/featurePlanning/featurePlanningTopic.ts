/**
 * 기능 정리 대화 진행 주제(단계별 집중).
 * `FeaturePlanningSlotsArtifactV1.planningTopic`에 저장.
 *
 * FSM: FEATURES → MENU → SCREENS → SCREEN_DETAILS → DATA → TASKS → DONE
 */
export const FEATURE_PLANNING_TOPICS = [
  "FEATURES",
  "MENU",
  "SCREENS",
  "SCREEN_DETAILS",
  "DATA",
  "TASKS",
  "DONE",
] as const;

export type FeaturePlanningTopicV1 = (typeof FEATURE_PLANNING_TOPICS)[number];

const TOPIC_SET = new Set<string>(FEATURE_PLANNING_TOPICS);

const ORDER = FEATURE_PLANNING_TOPICS as readonly FeaturePlanningTopicV1[];

/** 주제 전이: 한 턴에 최대 한 단계 앞으로만. 뒤로 가거나 건너뛰기는 클램프. DONE은 잠금. */
export function normalizePlanningTopicTransition(
  current: FeaturePlanningTopicV1,
  proposed: FeaturePlanningTopicV1 | undefined
): FeaturePlanningTopicV1 {
  if (!proposed) return current;
  if (current === "DONE") return "DONE";
  if (proposed === "DONE") {
    return current === "TASKS" ? "DONE" : current;
  }
  const i0 = ORDER.indexOf(current);
  const i1 = ORDER.indexOf(proposed);
  if (i0 < 0 || i1 < 0) return current;
  if (i1 === i0) return current;
  if (i1 === i0 + 1) return proposed;
  if (i1 > i0 + 1) return ORDER[Math.min(i0 + 1, ORDER.length - 1)] ?? current;
  return current;
}

/** 레거시 저장값·모델 출력 호환 */
export function parsePlanningTopic(raw: unknown): FeaturePlanningTopicV1 | undefined {
  let u = String(raw ?? "").trim().toUpperCase();
  if (!u) return undefined;
  if (TOPIC_SET.has(u)) return u as FeaturePlanningTopicV1;
  return undefined;
}

export function planningTopicLabelKo(topic: FeaturePlanningTopicV1): string {
  const m: Record<FeaturePlanningTopicV1, string> = {
    FEATURES: "핵심 기능",
    MENU: "메뉴 구조",
    SCREENS: "화면 목록",
    SCREEN_DETAILS: "화면 상세",
    DATA: "데이터 구조",
    TASKS: "프로토타입 Task",
    DONE: "정리 완료",
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
      return "지금은 **화면 상세**(입력·버튼·상태)만 다룹니다. 한 화면씩 짧게 정리하세요.";
    case "DATA":
      return "지금은 **데이터 구조**만 다룹니다. 주요 엔티티·필드 수준 초안과 짧은 질문만 하세요.";
    case "TASKS":
      return "지금은 **프로토타입 Task**만 다룹니다. 구현 단위 작업 초안과 짧은 질문만 하세요.";
    case "DONE":
      return "기능정리 단계가 마무리되었습니다. 요약만 짧게 하고 추가 질문은 하지 마세요.";
    default:
      return "";
  }
}
