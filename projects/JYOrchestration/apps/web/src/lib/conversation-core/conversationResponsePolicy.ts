import type {
  ConversationIntentClassification,
  ConversationIntentMode,
  ConversationResponsePolicy,
  ConversationScope,
} from "@/lib/conversation-core/conversationIntentTypes";
import { PRE_PROJECT_EXECUTION_SCOPE_BOUNDARY_PROMPT } from "@/lib/conversation/conversationScopeBoundary";
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
- 답변은 반드시 다음 중 2개 이상을 포함합니다:
  - 공식 API 여부
  - robots.txt 또는 이용약관 확인 필요
  - HTML 내 목록 데이터 포함 여부
  - 동적 네트워크 요청 여부
  - 페이지네이션 구조
  - 공개 범위 내 저빈도/수동 수집 가능성
- 사용자가 요청하지 않은 확장 기능을 제안하지 않습니다.
- 특히 아래 표현을 사용하지 않습니다:
  - 추천 시스템
  - 투표 기능
  - 정기 업데이트
  - 랭킹
  - 실시간 인기 아이디어
  - 참여 유도 기능
- [inspectionResult]가 제공되면 반드시 그 결과를 먼저 반영합니다.
- 실제 점검 결과가 있으면 "확인해야 합니다"만 반복하지 말고, 확인된 사실과 남은 확인 사항을 구분합니다.
- [inspectionResult]가 실패했으면 실패 사유를 말하고, 대체 확인 방법을 제시합니다.
- 마지막 문장은 상황에 맞게 작성합니다. 같은 마지막 문장을 반복하지 않습니다.
  - 점검 결과가 있으면 "이 기준이면 1차 수집 방식은 ○○가 적합합니다."처럼 결론으로 끝냅니다.
  - 점검 실패 시 "현재는 ○○ 때문에 자동 점검이 실패했으므로, 브라우저 개발자도구 또는 수동 확인이 필요합니다."처럼 끝냅니다.
- 「다음에는 수집 가능성 점검 항목과 판단 기준을 정리하겠습니다」와 같은 고정 마지막 문장을 사용하지 마세요.

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
- 현재 요청에 대한 정리를 현재 응답에서 제공합니다.
- 마지막은 현재 정리의 결론 또는 남은 선택지로 끝냅니다.
- 다음에 정리안/비교안을 만들겠다고 예고하지 않습니다.`;

const MESSENGER_PRE_PROJECT_OPTION_COMPARISON_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 현재 아이디어에 대한 **비교안·대안 비교·장단점 비교**를 요청했습니다.

역할:
- 현재 대화에서 나온 아이디어와 선택지를 비교 가능한 구조로 정리합니다.
- 사용자가 명시하지 않은 대안은 필요한 범위에서만 합리적으로 보완합니다.
- 비교안은 현재 응답에서 바로 작성합니다.
- 프로젝트 생성, JSON 저장, 자동 실행을 했다고 말하지 않습니다.

응답 규칙:
- 한국어로 답합니다.
- 가능하면 표 또는 짧은 섹션으로 비교합니다.
- 비교 기준은 목적, 대상 사용자, 핵심 기능, 구현 난이도, 장점, 한계, 추천 상황을 우선합니다.
- 마지막은 "현재 기준에서는 ○○안이 1차 접근에 적합합니다"처럼 판단으로 끝냅니다.
- "다음에는 비교안을 만들겠습니다"라고 말하지 않습니다.`;

const MESSENGER_PRE_PROJECT_DRAFT_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 **프로젝트 생성·프로토타입 준비·초안**을 요청했습니다.

역할:
- 대화 내용을 프로젝트 초안 관점으로 구조화합니다.
- 서비스 한 줄 요약, 목표 사용자, 핵심 가치, 범위 초안을 현재 응답에서 작성합니다.

응답 규칙:
- 한국어, 2~5문단.
- 사용자가 요청한 초안은 현재 응답에서 작성합니다.
- 프로젝트 승격, JSON 저장, 자동 생성 등 실제로 실행하지 않은 행동을 진행하겠다고 말하지 않습니다.
- 마지막은 현재 초안의 결론 또는 사용자가 검토할 핵심 선택지로 끝냅니다.`;

const MESSENGER_PRE_PROJECT_RESEARCH_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 **외부 조사·검색·실제 확인**이 필요한 요청을 했습니다.

역할:
- 직접 조사했다고 말하지 않습니다.
- 어떤 자료를 어떤 순서로 확인해야 하는지 계획을 제시합니다.

응답 규칙:
- 한국어, 2~4문단.
- 확인 출처·방법·리스크를 나열.
- 현재 응답에서 조사·검토 기준을 제시합니다.
- 직접 확인하지 않은 내용은 확인하지 않았다고 명시합니다.
- 다음에 체크리스트를 만들겠다고 예고하지 않습니다.`;

const MESSENGER_PRE_PROJECT_EXECUTION_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
사용자가 **구현·실행·작업지시**로 넘어가려 합니다.

역할:
- 아직 프로젝트가 없으면 승격·범위 확정을 먼저 제안합니다.
- 있으면 작업 단위·산출물·검증 포인트를 **텍스트로** 정리합니다 (service-flow·Viewer·실행 액션 없음).

응답 규칙:
- 한국어, 2~4문단.
- 내부 용어(Cursor, 하네스 등) 노출 금지.
- GENERATE_ALTERNATIVE, APPLY_PROPOSAL, 대안 비교 Viewer, service-flow analyze를 언급·실행하지 않습니다.`;

const MESSENGER_GENERAL_SYSTEM = `당신은 플랫폼의 「AI 기획자」입니다.
자유 대화방에서 사용자와 짧고 실무적으로 대화합니다.

응답 규칙:
- 한국어, 2~4문단.
- 현재 요청에 맞게 답합니다.
- 마지막은 현재 답변의 결론 또는 사용자가 판단할 수 있는 선택지로 끝냅니다.
- 실제 수행하지 않는 다음 행동을 약속하지 않습니다.`;

export function defaultResponsePolicyForMode(mode: ConversationIntentMode): ConversationResponsePolicy {
  switch (mode) {
    case "feasibility_check":
      return {
        avoidBrainstormExpansion: true,
        avoidFeatureFinalization: true,
        mustStateVerificationLimit: true,
        mustProvideCheckItems: true,
        avoidFutureActionPromise: true,
      };
    case "brainstorm":
      return { shouldOfferAlternatives: true, avoidFutureActionPromise: true };
    case "summary":
      return {
        shouldSummarizeDecisions: true,
        avoidFeatureFinalization: true,
        avoidFutureActionPromise: true,
      };
    case "option_comparison":
      return { shouldOfferAlternatives: true, avoidFutureActionPromise: true };
    case "project_draft":
      return { shouldPrepareProjectDraft: true, avoidFutureActionPromise: true };
    case "research_request":
      return {
        mustStateVerificationLimit: true,
        mustProvideCheckItems: true,
        avoidFutureActionPromise: true,
      };
    case "project_execution_planning":
      return { avoidBrainstormExpansion: true, avoidFutureActionPromise: true };
    case "general_chat":
      return { avoidFutureActionPromise: true };
    default:
      return { avoidFutureActionPromise: true };
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
  if (policy.avoidChecklistRepetition) {
    lines.push("- 같은 확인 체크리스트를 반복하지 않고, 점검 결과·실행 가능한 다음 조치 중심으로 답합니다.");
  }
  if (policy.avoidFutureActionPromise) {
    lines.push("- 실제로 실행하지 않는 다음 행동을 약속하지 않습니다.");
  }
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
      case "option_comparison":
        base = MESSENGER_PRE_PROJECT_OPTION_COMPARISON_SYSTEM;
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
  if (c.scope === "pre_project") parts.push(PRE_PROJECT_EXECUTION_SCOPE_BOUNDARY_PROMPT);
  if (input.personaLine?.trim()) parts.push(input.personaLine.trim());
  if (input.contextBlocksText?.trim()) parts.push(input.contextBlocksText.trim());
  const policyBlock = formatResponsePolicyBlock(c.responsePolicy);
  if (policyBlock) parts.push(policyBlock);
  const intentCtx =
    c.scope === "pre_project"
      ? c.mode === "feasibility_check"
        ? `[요청 컨텍스트] intent=${c.mode}. 마지막 user 항목이 현재 요청입니다. 가능한 범위에서 즉시 점검·결론 중심으로 답하세요.`
        : c.mode === "option_comparison"
          ? `[요청 컨텍스트] intent=${c.mode}. 비교안·대안 비교를 현재 응답에서 바로 작성하세요.`
          : `[요청 컨텍스트] intent=${c.mode}. 마지막 user 항목이 현재 요청입니다. 요청한 산출물은 현재 응답에서 처리하세요.`
      : `[요청 컨텍스트] intent=${c.mode}. 확정/미정/다음 작업 구조를 유지하세요.`;
  parts.push(intentCtx);
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
