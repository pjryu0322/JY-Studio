import type {
  ConversationIntentClassification,
  ConversationIntentMode,
  ConversationResponsePolicy,
  ConversationScope,
} from "@/lib/conversation-core/conversationIntentTypes";
import { buildAiPlannerSystemPrompt } from "@/lib/requirements/aiPlannerSystemPrompt";
import { PRE_PROJECT_BRAINSTORM_PLANNER_PROMPT } from "@/lib/requirements/aiPlannerSystemPrompt";

const MESSENGER_PRE_PROJECT_FEASIBILITY_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
현재 사용자는 아이디어 확장보다 **가능 여부·검토·확인**을 요청하고 있습니다.

역할:
- 실제로 확인하지 않은 사항을 단정하지 않습니다.
- 확인이 필요한 항목, 판단 기준, 제약을 구조적으로 제시합니다.
- URL·API·데이터 수집·크롤링·로봇 정책 등은 **공식 문서·이용약관·기술 구조 확인 전**까지 가능/불가를 단정하지 않습니다.

응답 규칙:
- 한국어, 2~4문단.
- 첫 문장: 사용자가 무엇을 확인하려는지 한 줄로 정리.
- 본문: 확인 항목 3~6개(또는 판단 기준)를 나열.
- 요청과 무관한 확장 기능(추천 시스템, 투표, 정기 업데이트, 랭킹 등)을 제안하지 않습니다.
- 마지막 문장: "다음에는 수집 가능성 점검 항목과 판단 기준을 정리하겠습니다"처럼 AI가 다음 산출물을 예고(질문 금지).

금지:
- "API가 있으면 API, 없으면 스크래핑"처럼 단정
- 이미 방문·확인한 것처럼 말하기
- 브레인스토밍식 기능 나열`;

const MESSENGER_PRE_PROJECT_SUMMARY_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 지금까지의 대화 **정리**를 요청했습니다.

역할:
- user 발화와 합의된 방향만 요약합니다.
- 확정하지 않은 내용은 "탐색 중" 또는 "미정"으로 표시합니다.
- 새 기능을 추가로 제안하지 않습니다.

응답 규칙:
- 한국어, 2~4문단 또는 짧은 불릿.
- 탐색 주제 / 명시된 제약 / 아직 열린 선택지 구분.
- 마지막: 다음에 만들 정리안·비교안을 예고(질문 금지).`;

const MESSENGER_PRE_PROJECT_DRAFT_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 **프로젝트 생성·프로토타입 준비·초안**을 요청했습니다.

역할:
- 대화 내용을 프로젝트 초안 관점으로 구조화합니다.
- 서비스 한 줄 요약, 목표 사용자, 핵심 가치, 범위 초안, 다음 단계를 제안합니다.

응답 규칙:
- 한국어, 2~5문단.
- 마지막: 프로젝트 승격 또는 초안 JSON 준비 등 다음 행동을 예고.`;

const MESSENGER_PRE_PROJECT_RESEARCH_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 **외부 조사·검색·실제 확인**이 필요한 요청을 했습니다.

역할:
- 직접 조사했다고 말하지 않습니다.
- 어떤 자료를 어떤 순서로 확인해야 하는지 계획을 제시합니다.

응답 규칙:
- 한국어, 2~4문단.
- 확인 출처·방법·리스크를 나열.
- 마지막: 조사·검토 체크리스트 정리를 예고.`;

const MESSENGER_PRE_PROJECT_EXECUTION_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 **구현·실행·작업지시**로 넘어가려 합니다.

역할:
- 아직 프로젝트가 없으면 승격·범위 확정을 먼저 제안합니다.
- 있으면 작업 단위·산출물·검증 포인트로 정리합니다.

응답 규칙:
- 한국어, 2~4문단.
- 내부 용어(Cursor, 하네스 등) 노출 금지.`;

const MESSENGER_GENERAL_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
자유 대화방에서 사용자와 짧고 실무적으로 대화합니다.

응답 규칙:
- 한국어, 2~4문단.
- 마지막 문장은 질문이 아니라 다음에 AI가 할 정리·비교·초안을 예고.`;

export function defaultResponsePolicyForMode(mode: ConversationIntentMode): ConversationResponsePolicy {
  switch (mode) {
    case "feasibility_check":
      return {
        avoidBrainstormExpansion: true,
        avoidFeatureFinalization: true,
        mustStateVerificationLimit: true,
        mustProvideCheckItems: true,
      };
    case "brainstorm":
      return { shouldOfferAlternatives: true };
    case "summary":
      return { shouldSummarizeDecisions: true, avoidFeatureFinalization: true };
    case "project_draft":
      return { shouldPrepareProjectDraft: true };
    case "research_request":
      return { mustStateVerificationLimit: true, mustProvideCheckItems: true };
    case "project_execution_planning":
      return { avoidBrainstormExpansion: true };
    default:
      return {};
  }
}

function formatResponsePolicyBlock(policy: ConversationResponsePolicy): string {
  const lines: string[] = [];
  if (policy.avoidBrainstormExpansion) lines.push("- 브레인스토밍식 확장 제안을 하지 않습니다.");
  if (policy.avoidFeatureFinalization) lines.push("- 기능·화면을 확정한 것처럼 말하지 않습니다.");
  if (policy.mustStateVerificationLimit) lines.push("- 실제 확인 전까지 가능/불가를 단정하지 않습니다.");
  if (policy.mustProvideCheckItems) lines.push("- 확인 항목·판단 기준을 구체적으로 제시합니다.");
  if (policy.shouldOfferAlternatives) lines.push("- 가능한 방향 2~3개를 제안할 수 있습니다.");
  if (policy.shouldSummarizeDecisions) lines.push("- 지금까지 내용을 요약·구분합니다.");
  if (policy.shouldPrepareProjectDraft) lines.push("- 프로젝트 초안 관점으로 구조화합니다.");
  if (!lines.length) return "";
  return `[응답 정책]\n${lines.join("\n")}`;
}

export function buildMessengerSystemPromptForIntent(input: {
  readonly classification: ConversationIntentClassification;
  readonly personaLine?: string;
  readonly contextBlocksText?: string;
}): string {
  const { classification: c } = input;
  let base: string;
  if (c.scope === "project") {
    base = buildAiPlannerSystemPrompt({
      mode: "project_single_chat",
    });
  } else {
    switch (c.mode) {
      case "feasibility_check":
        base = MESSENGER_PRE_PROJECT_FEASIBILITY_SYSTEM;
        break;
      case "summary":
        base = MESSENGER_PRE_PROJECT_SUMMARY_SYSTEM;
        break;
      case "project_draft":
        base = MESSENGER_PRE_PROJECT_DRAFT_SYSTEM;
        break;
      case "research_request":
        base = MESSENGER_PRE_PROJECT_RESEARCH_SYSTEM;
        break;
      case "project_execution_planning":
        base = MESSENGER_PRE_PROJECT_EXECUTION_SYSTEM;
        break;
      case "general_chat":
        base = MESSENGER_GENERAL_SYSTEM;
        break;
      case "brainstorm":
      default:
        base = PRE_PROJECT_BRAINSTORM_PLANNER_PROMPT;
        break;
    }
  }
  const parts = [base];
  if (input.personaLine?.trim()) parts.push(input.personaLine.trim());
  if (input.contextBlocksText?.trim()) parts.push(input.contextBlocksText.trim());
  const policyBlock = formatResponsePolicyBlock(c.responsePolicy);
  if (policyBlock) parts.push(policyBlock);
  parts.push(
    c.scope === "pre_project"
      ? `[요청 컨텍스트] intent=${c.mode}. 마지막 user 항목이 현재 요청입니다. 마지막 문장은 질문이 아니라 AI가 다음에 만들 산출물을 예고하세요.`
      : `[요청 컨텍스트] intent=${c.mode}. 확정/미정/다음 작업 구조를 유지하세요.`
  );
  return parts.join("\n\n");
}

/** 테스트·프롬프트 검증용 */
export function messengerBasePromptForMode(scope: ConversationScope, mode: ConversationIntentMode): string {
  return buildMessengerSystemPromptForIntent({
    classification: {
      mode,
      confidence: 1,
      reason: "test",
      scope,
      participationMode: scope === "pre_project" ? "planner_only" : "ai_team",
      shouldInjectDocumentContext: false,
      userConstraints: [],
      discardedDirections: [],
      openOptions: [],
      responsePolicy: defaultResponsePolicyForMode(mode),
    },
  });
}
