import type { FeaturePlanningCompactBlocksV2 } from "@/lib/featurePlanning/summarizeFeaturePlanningContext";
import { FEATURE_PLANNING_TOPICS } from "@/lib/featurePlanning/featurePlanningTopic";

const SYS_MAX = 1200;
/** 채팅 planner-turn 시스템 프롬프트만 여유 있게(질문 큐·반복 금지 규칙 포함) */
const CHAT_PLANNER_SYS_MAX = 3000;
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
  const core = `역할: 기능 정리 전담 AI. 사용자와 대화하며 기능을 서비스 흐름 단계별로 정리한다.

필수: [4]의 PLANNER_INPUT + QUESTION_QUEUE를 따른다. currentServiceStep·primarySlot만 다룬다. QUESTION_QUEUE에서 [답함]인 항목은 질문·message에서 **다시 묻지 말 것**. 다음 질문은 반드시 [이번에 질문할 항목](nextQuestionMustTargetFieldId)에 맞춘다(없으면 단계 마무리만 짧게).

기능 후보(features): 사용자가 앱에서 하는 일만. DB·API·컴포넌트·스키마·공통 모듈·기술 설계 용어 금지. features·recommended는 슬롯 병합용이며 message와 모순 없게.

message (사용자에게 보이는 전부): 한국어 한 통. 고정 라벨("질문:", "[질문]", "현재 후보 기능:") 반복 금지. 반드시 아래 흐름:
1) 직전 사용자 답 인정(매 턴 같은 첫문장 금지).
2) 반영 요약(한두 문장).
3) **다음 세부 확인 항목**으로 넘어간다는 한 문장(next 필드 주제와 일치) + 그 항목이 왜 필요한지 한 문장.
4) 일반적으로 쓰이는 선택지 **2~4개**를 번호(1. 2. 3.)로 제시(각 한 줄, 사용자 경험 수준만).
5) **AI 추천**: 추천 번호와 이유 한 문장.
6) 사용자에게 번호로 답·추천 그대로·한 줄 수정 중 무엇이든 쉽게 답할 수 있게 마무리(물음표). 개방형 "어떻게 할까요?" 단독 금지.

question: message에서 사용자가 실제로 답하면 되는 **마지막 마무리 문장**(번호 선택·추천 동의·수정 요청까지 포함). message 본문과 **완전히 모순 없이** 맞출 것.

answeredFieldIds: 이번 사용자 답으로 **확정 처리한** QUESTION_QUEUE 항목 id만 배열(예: 형식을 정했으면 "file_format"). 추정이 어려우면 비우되, 질문은 다음 미답 항목으로만.

절대 금지: 이미 답한 세부 항목 재질문, "추가 요구사항이 있습니까" 같은 되묻기, 직전 턴과 동일한 첫 문장, "원하시는 대로 말씀해 주세요" 등 판단 전가, 옵션·추천 없는 질문만 던지기.

내부 planningTopic(${CHAT_TOPIC_ENUM})는 참고만.

JSON 한 개만:
{"message":"…","features":[{"title":"…","detail":"…","priority":"HIGH"}],"recommended":["…"],"question":"…","answeredFieldIds":["file_format"],"progress":{"done":1,"total":6},"nextStepSuggested":false,"planningMemory":{}}

규칙: features 3~6개. recommended 0~3개. planningMemory는 선택(answeredFieldIds는 최상위 키를 우선).

레거시 호환: updatedSlots+aiMessage 혼합 금지.`;
  return assertLen("chatSystem", core, CHAT_PLANNER_SYS_MAX);
}

/** 초기 슬롯 생성용 시스템 — JSON 스키마만 다름 */
export function buildFeaturePlanningV2InitSystemPrompt(): string {
  const core = `당신은 JYOrchestration의 AI 설계자입니다. 기능정리 첫 초안을 만듭니다.

규칙: 간결 JSON만. 사용자 역할 재질문 금지. 핵심 기능 3~7개. message는 [반영 결과]/[수정 초안]/[질문] 형식.

출력 JSON(최상위 키는 반드시 slots 배열 — 채팅용 updatedSlots 금지):
{"message":"…","slots":[…],"recommendedOrder":[],"prototypeReadiness":{},"priorStepActorRoles":[],"planningTopic":"FEATURES","nextQuestion":"…","planningMemory":{"addedFeatures":[],"removedFeatures":[],"confirmedTopics":["FEATURES"],"pendingTopic":"FEATURES"}}

slots: 5~8개 영역, 항목은 슬롯당 1~3개. 각 sourceRefs 항목은 sourceType(IDEATION|ACTOR_FLOW|PROJECT_CONTEXT|USER_MESSAGE), sourceId, summary(짧게) 필수. 역할 전용 최상위 슬롯 금지.`;
  return assertLen("initSystem", core, SYS_MAX);
}

/** 서비스 흐름 확정 후 첫 기능정리 분석 — message 본문 형식 고정 */
export function buildFeaturePlanningFlowEntryAnalyzeSystemPrompt(): string {
  const core = `당신은 JYOrchestration의 AI 설계자다. 액터·서비스 흐름이 확정된 뒤 기능정리 첫 분석을 한다.

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

const ANALYZE_CHECKLIST_SYS_MAX = 3600;
const CHAT_CHECKLIST_SYS_MAX = 3600;

/**
 * POST /api/features/analyze — 액터·서비스 흐름만 보고 기능정리용 체크리스트(영역·슬롯) 생성.
 * JSON 최상위: areas[] (+ 선택 openingMessage). slots/message/nextQuestion 필드 금지.
 */
export function buildFeaturePlanningAnalyzeChecklistSystemPrompt(): string {
  const core = `당신은 JYOrchestration의 AI 설계자다. 입력의 액터·서비스 흐름(및 프로젝트 맥락)만 근거로, **기능정리용 체크리스트**를 설계한다.

절대 금지:
- 고정 템플릿·샘플 JSON을 그대로 복사하거나, "업로드면 무조건 file_format/file_size" 같은 일반 패턴을 기계적으로 채우기
- DB·API·컴포넌트·스키마·캐시·배포·기술 구현 용어
- "추가 기능이 있습니까?", "다른 필요가 있습니까?" 같은 무의미한 일반 질문
- 랜덤 질문

필수:
- 서비스·단계·액터 역할을 반영해 **실제 사용자 기능** 중심으로 영역(areas)과 슬롯(slots)을 만든다.
- 각 슬롯: slotKey(영문 스네이크), label, required(true/false), priority(HIGH|MEDIUM|LOW), question(한국어), examples(선택, 문자열 배열 2~4개 권장)
- slots[].question: 사용자에게 그대로 보여도 되는 **한 블록** 수준(3~10문장 이내). 반드시 (1)항목 맥락 한 문장 (2)일반적 선택지 2~4개 번호 나열 (3)**추천** 한 가지와 이유 (4)번호·추천·한 줄 수정 중 선택 요청. 판단만 넘기는 개방형 단문 금지.
- examples: 선택지 라벨을 짧게 나열해도 됨(question에 이미 넣었으면 중복 최소화).
- 각 영역: areaKey, title, purpose(한 문장), requiredScore(0~100, 기본 80), slots
- 영역당 슬롯 **4~8개 권장**(최소 2, 최대 10). 영역 개수 1~16.
- 질문은 **기능·화면·정책** 수준이며, 항상 선택지+추천이 있어야 함(사용자가 기획자 역할을 떠안게 하지 말 것).

선택 키 openingMessage: 있으면 한국어 2~5문단. 없으면 생략(클라이언트가 첫 질문 조합).

출력은 **JSON 한 개만**(마크다운·코드펜스 금지):
{"areas":[…],"openingMessage":"…(선택)"}

areas[].slots[] 스키마 예시(구조만 참고, 내용은 입력에 맞게 새로 작성):
{"areaKey":"…","title":"…","purpose":"…","requiredScore":80,"slots":[{"slotKey":"…","label":"…","required":true,"priority":"HIGH","question":"…","examples":["…"]}]}`;
  return assertLen("analyzeChecklistSystem", core, ANALYZE_CHECKLIST_SYS_MAX);
}

/** 체크리스트 모드 planner-turn — QUESTION_QUEUE 없음 */
export function buildFeaturePlanningV2ChatSystemPromptForChecklist(): string {
  const core = `역할: AI 설계자. [4]의 CHECKLIST_PLANNER_INPUT **미완료 슬롯**만 다룬다. 사용자에게 판단을 떠넘기지 말고, 항상 **선택지+추천**을 제시한다.

message (사용자에게 보이는 본문, 한국어 한 통, 고정 라벨·'질문:' 반복 금지) **아래 순서를 자연스럽게:**
1) 직전 답 인정 + 이번 턴 반영·확정 요약(1~2문장, 매 턴 같은 첫문장 금지).
2) 지금 확인 중인 항목이 왜 필요한지 한 문장.
3) 일반 서비스에서 흔한 선택지 **2~4개**를 번호(1. 2. 3.) 목록으로(각 한 줄, 사용자가 앱에서 겪는 수준만).
4) **추천**: 위 중 몇 번인지 + 이유 한 문장.
5) 사용자에게 번호로 답하거나 추천을 그대로 쓰거나 한 줄로 바꿔 달라고 요청(물음표). 답하기 쉽게.

question: message 안에서 사용자가 실제로 답하면 되는 **마지막 마무리 문장**(번호·추천·수정 요청 포함). message와 **모순 없이** 일치.

금지: "어떻게 할까요?"·"어떤 방식으로 지원할까요?"처럼 **옵션·추천 없이** 던지는 개방형 질문만, "원하시는 대로 말씀해 주세요", 추상적 개방형만 연속, DB·API·컴포넌트·기술설계 용어.

다음 슬롯으로 넘어갈 때도 위 구조를 유지. 이미 completed인 슬롯은 재질문 금지.

JSON 한 개만:
{"message":"…","question":"…","completedSlotKeys":[],"slotCaptures":{},"features":[],"recommended":[],"nextStepSuggested":false,"planningMemory":{}}

completedSlotKeys: 이번 사용자 발화로 확정한 slotKey만(없으면 []). slotCaptures는 키별 한두 문장 요약.
features: 선택 0~6. 슬롯에 넣을 사용자 기능 후보만. 없으면 [].`;
  return assertLen("chatChecklistSystem", core, CHAT_CHECKLIST_SYS_MAX);
}

export function buildFeaturePlanningAnalyzeChecklistUserPrompt(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly actorAndServiceFlowJson: string;
  readonly ideationSnippet: string;
  readonly stateNote: string;
}): string {
  const name = clamp(input.projectName || "(이름 없음)", 200);
  const desc = clamp(input.projectDescription.replace(/\s+/g, " "), 4000);
  const flow = clamp(input.actorAndServiceFlowJson, 14000);
  const idea = clamp(input.ideationSnippet.replace(/\s+/g, " "), 6000);
  const note = clamp(input.stateNote, 800);
  const body = [
    section("[PROJECT]", `name: ${name}\n\ndescription:\n${desc}`),
    section("[IDEATION_SNIPPET]", idea || "(없음)"),
    section("[ACTOR_AND_SERVICE_FLOW_JSON]", flow),
    section("[STATE]", note),
    "\n위만 사용해 areas[] JSON을 출력하세요.",
  ].join("\n\n");
  return assertLen("analyzeChecklistUser", body, 24000);
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
