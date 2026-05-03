import type { FeaturePlanningCompactBlocksV2 } from "@/lib/featurePlanning/summarizeFeaturePlanningContext";
import { FEATURE_PLANNING_TOPICS } from "@/lib/featurePlanning/featurePlanningTopic";

const SYS_MAX = 1200;
const DYNAMIC_BODY_MAX = 2200;
const RECENT_MAX = 800;
const USER_TOTAL_MAX = 3300;

function clamp(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function assertLen(label: string, s: string, max: number): string {
  if (s.length > max) {
    return clamp(s, max);
  }
  return s;
}

/** 대략적 토큰 수(문자/4) — 로깅용 */
export function estimateTokensRough(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

const CHAT_TOPIC_ENUM = FEATURE_PLANNING_TOPICS.join("|");

/**
 * 기능정리 채팅 턴용 시스템 프롬프트 — 토큰 절감형, 길이 상한 적용.
 */
export function buildFeaturePlanningV2ChatSystemPrompt(): string {
  const core = `당신은 JYOrchestration의 AI 기획자입니다. 기능정리 단계에서 사용자와 협업합니다.

규칙:
1. 장황한 설명 금지.
2. 현재 planningTopic만 다룹니다.
3. 출력 형식: [반영 결과]…[수정 초안] 번호 목록…[질문] 한 개만.
4. 숫자만 답(1번,2,2번)은 직전 [수정 초안] 번호 선택으로 해석합니다.
5. 슬롯 구조는 유지하고 요청된 부분만 수정합니다(전체 갈아엎기 금지).
6. 한국어, 실무 기획자 말투.

FSM: FEATURES→MENU→SCREENS→SCREEN_DETAILS→DATA→TASKS→DONE. 한 턴에 한 단계만 앞으로.

JSON 한 개만:
{"updatedSlots":[...],"recommendedOrder":["…"],"prototypeReadiness":{},"aiMessage":"…","planningTopic":"${CHAT_TOPIC_ENUM}","planningMemory":{"priorityFeature":"","addedFeatures":[],"removedFeatures":[],"confirmedTopics":[],"pendingTopic":"","lastUserIntent":"","notes":[]},"changeSummary":[],"nextQuestions":[],"newFeatureCandidates":[],"filledSlotsSummary":[]}

planningMemory는 이번 턴 추출한 요약만 채웁니다. confirmedTopics는 마친 단계만 문자열 배열로.`;
  return assertLen("chatSystem", core, SYS_MAX);
}

/** 초기 슬롯 생성용 시스템 — JSON 스키마만 다름 */
export function buildFeaturePlanningV2InitSystemPrompt(): string {
  const core = `당신은 JYOrchestration의 AI 기획자입니다. 기능정리 첫 초안을 만듭니다.

규칙: 간결 JSON만. 사용자 역할 재질문 금지. 핵심 기능 3~7개. message는 [반영 결과]/[수정 초안]/[질문] 형식.

출력 JSON(최상위 키는 반드시 slots 배열 — 채팅용 updatedSlots 금지):
{"message":"…","slots":[…],"recommendedOrder":[],"prototypeReadiness":{},"priorStepActorRoles":[],"planningTopic":"FEATURES","nextQuestion":"…","planningMemory":{"addedFeatures":[],"removedFeatures":[],"confirmedTopics":["FEATURES"],"pendingTopic":"FEATURES"}}

slots: 5~8개 영역, 항목은 슬롯당 1~3개. 각 sourceRefs 항목은 sourceType(IDEATION|ACTOR_FLOW|PROJECT_CONTEXT|USER_MESSAGE), sourceId, summary(짧게) 필수. 역할 전용 최상위 슬롯 금지.`;
  return assertLen("initSystem", core, SYS_MAX);
}

function section(title: string, body: string): string {
  return `${title}\n${body.trim()}`;
}

/**
 * v2 사용자 프롬프트 — 7블록 + 입력. raw JSON·전체 대화 주입 없음.
 * 블록 5(최근 대화)는 800자 상한, 그 외 동적 맥락(1~4,6,7,USER,푸터)은 2200자 상한을 목표로 한다.
 */
export function buildFeaturePlanningV2UserPromptFromBlocks(blocks: FeaturePlanningCompactBlocksV2): string {
  let b1 = blocks.projectSummary;
  let b2 = blocks.actorSummary;
  let b3 = blocks.flowSummary;
  let b4 = blocks.slotSummary;
  const b5 = assertLen("recent", blocks.recentConversation, RECENT_MAX);
  let b6 = blocks.memoryStateJson;
  const b7 = blocks.currentTaskInstruction;
  const u = blocks.userLatestInput;
  const footer = "\n\n위 맥락만 사용해 JSON을 출력하세요. 입력에 없는 내용은 추측하지 마세요.";

  const allSections = (a1: string, a2: string, a3: string, a4: string, a5: string, a6: string) =>
    [
      section("[1. PROJECT SUMMARY]", a1),
      section("[2. ACTOR SUMMARY]", a2),
      section("[3. FLOW SUMMARY]", a3),
      section("[4. CURRENT SLOT SUMMARY]", a4),
      section("[5. RECENT CONVERSATION]", a5),
      section("[6. MEMORY STATE]", a6),
      section("[7. CURRENT TASK INSTRUCTION]", b7),
      section("[USER LATEST]", u),
    ].join("\n\n") + footer;

  /** 블록 1~4,6,7,USER,푸터 합이 2200 이하가 되도록 슬롯·요약 위주로만 축소 */
  const nonRecentBudget = DYNAMIC_BODY_MAX;
  const measureNonRecent = (a1: string, a2: string, a3: string, a4: string, a6: string) =>
    [
      section("[1. PROJECT SUMMARY]", a1),
      section("[2. ACTOR SUMMARY]", a2),
      section("[3. FLOW SUMMARY]", a3),
      section("[4. CURRENT SLOT SUMMARY]", a4),
      section("[6. MEMORY STATE]", a6),
      section("[7. CURRENT TASK INSTRUCTION]", b7),
      section("[USER LATEST]", u),
    ].join("\n\n") + footer;

  for (let i = 0; i < 28; i++) {
    const nr = measureNonRecent(b1, b2, b3, b4, b6);
    if (nr.length <= nonRecentBudget) break;
    b4 = clamp(b4, Math.max(48, Math.floor(b4.length * 0.82)));
    b1 = clamp(b1, Math.max(32, Math.floor(b1.length * 0.88)));
    b2 = clamp(b2, Math.max(32, Math.floor(b2.length * 0.88)));
    b3 = clamp(b3, Math.max(32, Math.floor(b3.length * 0.88)));
    b6 = clamp(b6, Math.max(24, Math.floor(b6.length * 0.88)));
  }
  let nrFinal = measureNonRecent(b1, b2, b3, b4, b6);
  if (nrFinal.length > nonRecentBudget) {
    const r = nonRecentBudget / Math.max(1, nrFinal.length);
    b1 = clamp(b1, Math.max(24, Math.floor(b1.length * r)));
    b2 = clamp(b2, Math.max(24, Math.floor(b2.length * r)));
    b3 = clamp(b3, Math.max(24, Math.floor(b3.length * r)));
    b4 = clamp(b4, Math.max(32, Math.floor(b4.length * r)));
    b6 = clamp(b6, Math.max(16, Math.floor(b6.length * r)));
    nrFinal = measureNonRecent(b1, b2, b3, b4, b6);
    if (nrFinal.length > nonRecentBudget) {
      b1 = clamp(b1, 80);
      b2 = clamp(b2, 80);
      b3 = clamp(b3, 80);
      b4 = clamp(b4, 120);
      b6 = clamp(b6, 80);
    }
  }
  const body = allSections(b1, b2, b3, b4, b5, b6);
  return assertLen("userTotal", body, USER_TOTAL_MAX);
}
