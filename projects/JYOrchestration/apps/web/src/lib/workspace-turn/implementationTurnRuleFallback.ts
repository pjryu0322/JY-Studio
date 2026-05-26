import {
  extractRulesFromTextForTurn,
  isExplicitImplementationExecutionRequest,
} from "@/lib/prototype/implementationUserFeedback";
import type { WorkspaceTurnModelResult } from "@/lib/workspace-turn/workspaceTurnTypes";

const IMPLEMENTATION_QUESTION_PATTERNS = [
  /더\s*뭘\s*정의|뭘\s*더\s*정의|무엇을\s*더\s*정의|뭘\s*정해|어떻게\s*진행|무엇부터/i,
  /도움\s*요청|가이드|체크리스트|뭐부터/i,
];

const PREFERENCE_PATTERNS = [
  /좋겠|하면\s*좋|원해|희망|이면\s*좋|채팅형|채팅\s*형|ui\s*는/i,
];

function isImplementationHelpQuestion(text: string): boolean {
  return IMPLEMENTATION_QUESTION_PATTERNS.some((p) => p.test(text));
}

function isAmbiguousPreference(text: string): boolean {
  if (!PREFERENCE_PATTERNS.some((p) => p.test(text))) return false;
  const rules = extractRulesFromTextForTurn(text);
  return rules.length === 0 || rules.every((r) => r.confidence !== "high");
}

function buildImplementationQuestionResponse(): string {
  return [
    "구현 작업안을 더 구체화하려면 다음 항목을 정하면 됩니다.",
    "",
    "1. 채팅형 UI 적용 범위",
    "2. 파일 업로드 제한 조건",
    "3. 결과 편집 방식",
    "4. 다운로드 형식",
    "5. 사용자/관리자 권한 차이",
    "6. 임시파일·보관 정책",
    "7. 오류/재시도 처리",
    "",
    "우선 「채팅형 UI 적용 범위」부터 정하는 것이 좋습니다.",
  ].join("\n");
}

function buildPreferenceResponse(text: string): WorkspaceTurnModelResult {
  const topic = /채팅/i.test(text) ? "채팅형 UI" : "요청하신 방향";
  return {
    intent: "implementation_preference",
    status: "candidate",
    confidence: "medium",
    responderLabel: "AI 개발자",
    assistantMessage: [
      `${topic} 방향을 구현 후보로 반영했습니다.`,
      "",
      "확정 전 확인이 필요한 항목:",
      "- 전체 서비스를 채팅형으로 구성할지",
      "- 파일 업로드와 결과 확인도 채팅 흐름에 포함할지",
      "- 회의록 수정·검토만 채팅형으로 처리할지",
      "",
      "우선 채팅형 UI 적용 범위를 정하면 됩니다.",
    ].join("\n"),
    summary: `${topic} 후보 반영`,
    extractedRules: [{ label: "구현 방향", value: text.trim().slice(0, 200), confidence: "medium" }],
    targetAreas: ["screen_implementation_items", "common_detail_features"],
    requiresClarification: true,
    clarifyingQuestion: "채팅형 UI 적용 범위 정하기",
    nextQuestion: null,
  };
}

function buildConfirmedRequirementResponse(
  text: string,
  rules: WorkspaceTurnModelResult["extractedRules"],
): WorkspaceTurnModelResult {
  const ruleLines = rules.map((r) => `- ${r.label}: ${r.value}`).join("\n");
  const intent = rules.some((r) => /보안|임시|삭제|개인정보/i.test(r.label))
    ? "security_policy"
    : "implementation_requirement";

  return {
    intent,
    status: "confirmed_candidate",
    confidence: "high",
    responderLabel: "AI 개발자",
    assistantMessage: [
      "요청하신 구현 기준을 반영했습니다.",
      "",
      "반영 항목:",
      ruleLines,
      "",
      "반영 위치:",
      "- 업로드 기능 검증 기준",
      "- 파일 보안 기준",
      "- 공통 상세기능",
      "- AI검수자/AI보안관 점검 기준",
      "",
      "단, Code Agent WIP 작업 요청은 실행 환경 점검이 완료된 뒤 진행할 수 있습니다.",
    ].join("\n"),
    summary: "구현 기준 확정 후보 반영",
    extractedRules: rules,
    targetAreas: [
      "implementation_seed",
      "implementation_work_plan_draft",
      "review_criteria",
      "security_criteria",
      "common_detail_features",
    ],
    requiresClarification: false,
    clarifyingQuestion: null,
    nextQuestion: null,
  };
}

/** LLM 실패·오프라인 시 구현단계 rule 분석 */
export function fallbackAnalyzeImplementationUserTurnByRule(input: {
  readonly userMessage: string;
  readonly envOk: boolean;
}): WorkspaceTurnModelResult {
  const text = String(input.userMessage ?? "").trim();
  if (!text) {
    return {
      intent: "unknown",
      status: "none",
      confidence: "low",
      responderLabel: "AI 개발자",
      assistantMessage: "구현 관련 요청을 입력해 주세요.",
      summary: "empty",
      extractedRules: [],
      targetAreas: [],
      requiresClarification: false,
      clarifyingQuestion: null,
      nextQuestion: null,
    };
  }

  if (isExplicitImplementationExecutionRequest(text)) {
    return {
      intent: "execution_request",
      status: "blocked",
      confidence: "high",
      responderLabel: "AI 개발자",
      assistantMessage: input.envOk
        ? "실행 요청은 채팅 입력 대신 화면의 실행 버튼·칩을 사용해 주세요."
        : "먼저 실행 환경 점검을 완료해 주세요.",
      summary: "execution_request",
      extractedRules: [],
      targetAreas: [],
      requiresClarification: false,
      clarifyingQuestion: null,
      nextQuestion: null,
    };
  }

  if (isImplementationHelpQuestion(text)) {
    const body = buildImplementationQuestionResponse();
    return {
      intent: "implementation_question",
      status: "question",
      confidence: "high",
      responderLabel: "AI 개발자",
      assistantMessage: body,
      summary: "implementation guidance",
      extractedRules: [],
      targetAreas: [],
      requiresClarification: false,
      clarifyingQuestion: null,
      nextQuestion: "채팅형 UI 적용 범위 정하기",
    };
  }

  if (isAmbiguousPreference(text)) {
    return buildPreferenceResponse(text);
  }

  const rules = extractRulesFromTextForTurn(text);
  if (rules.length > 0) {
    return buildConfirmedRequirementResponse(text, rules);
  }

  return {
    intent: "unknown",
    status: "question",
    confidence: "medium",
    responderLabel: "AI 개발자",
    assistantMessage: [
      "구현 작업안에 반영할 내용을 조금 더 구체적으로 알려주시면 좋습니다.",
      "예: 허용 파일 형식, 용량 제한, UI 방식, 권한 차이, 임시파일 처리 등",
    ].join("\n"),
    summary: "needs detail",
    extractedRules: [],
    targetAreas: [],
    requiresClarification: true,
    clarifyingQuestion: "구현 기준 구체화하기",
    nextQuestion: null,
  };
}
