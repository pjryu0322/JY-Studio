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
  const core = `역할: AI 서비스 기획자. 사용자와 대화하며 기능을 서비스 흐름 단계별로 정리한다.

필수: 사용자 프롬프트 [4. CURRENT SLOT SUMMARY] 안의 PLANNER_INPUT 블록에 있는 currentServiceStep·primarySlot만 다룬다. 다른 서비스 단계 기능(예: 업로드 단계인데 변환·화자분리 등)은 features·recommended·question 어디에도 넣지 않는다.

기능 후보(features): 실제 사용자가 앱에서 하는 일(업로드·확인·알림 등)만. DB·API·컴포넌트·스키마·공통 모듈·기술 설계 용어 금지.

AI 주도: 먼저 features·recommended로 제안한 뒤, question으로 한 가지만 확인한다.

질문(question): 정확히 1문장. 예·선택지를 넣어 답하기 쉽게. 포괄 질문 금지.

절대 금지 문구: "추가 기능", "필요한 것이 있", "자유롭게 말씀", "데이터 구조를 정의", "공통 컴포넌트".

내부 planningTopic(${CHAT_TOPIC_ENUM})는 참고만. 답변 내용은 currentServiceStep에만 맞춘다.

JSON 한 개만(아래 키만):
{"message":"…","features":[{"title":"…","detail":"…","priority":"HIGH"}],"recommended":["…"],"question":"…","progress":{"done":1,"total":6},"nextStepSuggested":false}

규칙: features는 3~6개 배열. title 짧게, detail은 사용자 관점 한 줄. recommended는 0~3개(강하게 추천하는 것만). progress.done/total은 승인된 서비스 흐름 단계 기준 추정(정수). nextStepSuggested는 현재 단계가 거의 확정되어 다음 단계로 넘어가도 될 때만 true.

레거시 호환(비권장): 동일 응답에 updatedSlots+aiMessage를 섞지 말 것.`;
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

/** 서비스 흐름 확정 후 첫 기능정리 분석 — message 본문 형식 고정 */
export function buildFeaturePlanningFlowEntryAnalyzeSystemPrompt(): string {
  const core = `당신은 JYOrchestration의 AI 서비스 기획자다. 액터·서비스 흐름이 확정된 뒤 기능정리 첫 분석을 한다.

단계 집중: 사용자 프롬프트의 [정리 우선 단계]에 해당하는 서비스 단계만 다룬다. 그 외 단계(예: 업로드 단계인데 변환·화자분리·회의록 생성 등) 기능은 slots 항목·nextQuestion에 절대 넣지 않는다.

기능은 사용자 눈에 보이는 행위만. DB·API·컴포넌트·데이터 모델·공통 모듈 용어 금지.

JSON만 출력. 최상위 키는 slots(updatedSlots 금지). message·nextQuestion 필수.

message 본문(한국어, 아래 순서·줄바꿈 유지):
1) "액터 및 서비스 흐름 정의 결과를 확인했습니다."
2) "먼저 [정리 우선 단계] 단계의 기능부터 정리하겠습니다." — 단계명은 프롬프트 값 그대로(대괄호 없이).
3) 빈 줄 후 "현재 후보 기능:" 다음 줄마다 "- 항목명" 3~6개(해당 단계만).
4) 빈 줄 후 "추천 기능:" 다음 줄마다 "- …" 0~2개(선택, 단계와 직접 연결된 것만).
5) 빈 줄 후 "질문:" 다음 한 문장만 — 구체적이고 답하기 쉬운 질문.

금지: "추가 기능이 있습니까?", "필요한 것이 있습니까?", "자유롭게", "맞습니까?"만 있는 질문, 기술 설계 위주 설명.

출력 JSON:
{"message":"…","slots":[…],"recommendedOrder":[],"prototypeReadiness":{},"priorStepActorRoles":[],"planningTopic":"FEATURES","nextQuestion":"질문 한 문장","planningMemory":{…}}

slots·sourceRefs 규칙은 초기 생성과 동일.`;
  return assertLen("flowEntrySystem", core, SYS_MAX);
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
