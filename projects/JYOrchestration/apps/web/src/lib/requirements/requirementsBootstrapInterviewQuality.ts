/**
 * SingleChat bootstrap 첫 질문·선택지 품질 검사(orchestration-first, slot label 회피).
 */

/** 질문에 반드시 포함 권장(프로젝트 도메인·오케스트레이션 앵커) */
export const BOOTSTRAP_QUESTION_DOMAIN_LEXEMES = [
  "회의록",
  "녹취",
  "화자",
  "요약",
  "검토",
  "수정",
  "확정",
  "자동화",
  "실시간",
  "배치",
  "협업",
  "산출물",
] as const;

/** Phase1 compact 카탈로그·UI와 동일 계열 — 질문에 그대로 넣지 말 것 */
const BOOTSTRAP_SLOT_LABEL_BANNED_PHRASES: readonly string[] = [
  "서비스 목적",
  "문제 정의",
  "핵심 사용자",
  "MVP 범위",
  "기대 효과",
  "핵심 가치",
  "해결 우선순위",
  "성공 기준",
  "액터 유형",
  "권한 관계",
  "서비스 흐름",
  "외부 연동",
  "예외 흐름",
  "운영 흐름",
  "승인 흐름",
  "사용자 상태 변화",
  "핵심 기능",
  "기능 우선순위",
  "프로토타입 범위",
  "자동화·AI 처리 수준",
  "초기 구현·프로토타입 경계",
  "협업·공동 편집",
  "필수 화면",
  "기능 의존성",
  "데이터 흐름",
  "구현 위험",
  "MVP 제외 범위",
  "UI 톤",
  "정보 구조",
  "민감 데이터",
  "인증",
  "위협 모델",
];

const DECISION_AXIS_RE =
  /(포함|필요|할지|여부|어떤|어떻게|어느|방식|단계|누가|직접|자동|공동|승인|검토|확정|수정|담당|분기|범위|기준|선택|아니면|vs|까지|인가요|일까요|겠어요|주실|주시겠|될까|됩니까)/;

const META_SUGGESTION_BANNED = [
  "기대 효과 설명",
  "기타 관련 정보",
  "핵심 사용자 정의",
  "서비스 목적 설명",
  "문제 정의 작성",
  "MVP 범위 정리",
  "관련 정보",
  "추가 설명",
  "자세히 설명",
];

/** 조직도·역할 라벨 나열형 칩 — 실제 서비스 행동·흐름 선택지가 아님 */
const GENERIC_ROLE_OR_META_SUGGESTION_SUBSTRINGS: readonly string[] = [
  "프로젝트 매니저",
  "프로젝트 매니져",
  "개발 팀",
  "개발팀",
  "팀 리더",
  "운영팀",
  "운영 팀",
  "기획자만",
  "SI ",
  " SI",
  "시스템 통합",
];

/** 사용자 질문에 노출하면 안 되는 내부 오케스트레이션 식별어(SI·문서 인터뷰 톤 유발) */
const INTERNAL_ORCH_VOCAB_KO: readonly string[] = [
  "승인 책임",
  "오케스트레이션",
  "자동화 수준",
  "프로토타입 경계",
  "협업 경계",
  "워크플로 분기",
  "리스크 시그널",
  "품질 검증 축",
];

const INTERNAL_ORCH_VOCAB_EN_SUBSTRINGS: readonly string[] = [
  "automation level",
  "prototype boundary",
  "workflow branching",
  "collaboration boundary",
  "approval responsibility",
  "orchestration",
  "risk signal",
  "quality validation",
  "editing authority",
  "realtime-batch distinction",
];

const INTERNAL_AXIS_ID_RE =
  /(workflow-branching|collaboration-boundary|approval-responsibility|automation-level|quality-validation|prototype-boundary|editing-authority|realtime-batch-distinction)/i;

/** primaryDecisionAxis 등 내부 축 → 타임라인용 UX 스타일 태그(하드코딩 질문 아님) */
export function inferUserFacingQuestionStyleFromAxis(primaryDecisionAxis: string | null | undefined): string {
  const raw = String(primaryDecisionAxis ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!raw) return "general-workflow";
  if (raw.includes("approval")) return "workflow-confirmation";
  if (raw.includes("workflow") && raw.includes("branch")) return "flow-branch";
  if (raw.includes("automation")) return "automation-scope";
  if (raw.includes("collaboration")) return "collaboration-pattern";
  if (raw.includes("quality")) return "quality-check-pattern";
  if (raw.includes("prototype")) return "scope-prototype";
  if (raw.includes("editing")) return "edit-permissions";
  if (raw.includes("realtime") || raw.includes("batch")) return "timing-mode";
  return "general-workflow";
}

/** 사용자 대면 question에 내부 축·메타 용어가 직접 들어갔는지 */
export function detectInternalOrchestrationVocabInUserQuestion(question: string): boolean {
  const q = String(question ?? "");
  if (!q.trim()) return false;
  const lower = q.toLowerCase();
  if (INTERNAL_ORCH_VOCAB_KO.some((p) => q.includes(p))) return true;
  if (INTERNAL_ORCH_VOCAB_EN_SUBSTRINGS.some((p) => lower.includes(p))) return true;
  if (INTERNAL_AXIS_ID_RE.test(q)) return true;
  return false;
}

export type BootstrapQuestionQualityIssueCode =
  | "slot_label_question"
  | "multi_slot_question"
  | "missing_domain_anchor"
  | "multi_question_marks"
  | "generic_what_only"
  | "weak_decision_axis"
  | "internal_orchestration_vocab_question"
  | "document_interview_tone"
  | "question_first_ux";

/** question-first(빈 설계 질문) 패턴 — 하드코딩 질문 테이블이 아니라 UX 휴리스틱 */
export function detectQuestionFirstUx(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  const patterns: RegExp[] = [
    /첫\s*단계는\s*무엇/,
    /어떤\s*액터/,
    /무엇을\s*(할|하시|해|해야)/,
    /무엇입니까/,
    /뭘\s*(할|해)/,
    /어떻게\s*하시겠/,
    /어디서\s*시작/,
    /처음부터\s*(설명|알려)/,
    /어떤\s*기능이\s*필요/,
    /무엇이\s*필요하신가요/,
    /무엇이\s*필요한가요/,
    /무엇을\s*원하시/,
    /무엇부터\s*(할|진행)/,
  ];
  return patterns.some((re) => re.test(t));
}

/** proposal-first 초안 구조(흐름·액터·단계 제안 + 검토 CTA) */
export function hasProposalFirstStructure(text: string): boolean {
  const t = String(text ?? "").trim();
  if (t.length < 48) return false;
  const hasProposalLex = /예상|초안|후보|제안|흐름|액터|단계|역할|기능|범위|이해했/.test(t);
  const hasStructure = /(\d+[\.\)]\s|[-•]\s)/.test(t) || /:\s*\n/.test(t);
  const hasReviewCta = /선택|수정|맞는지|검토|확인해\s*주|이대로/.test(t);
  return hasProposalLex && (hasStructure || hasReviewCta);
}

export function analyzeBootstrapQuestionQuality(input: {
  readonly question: string;
  readonly projectDescription: string;
}): { readonly ok: boolean; readonly issues: readonly BootstrapQuestionQualityIssueCode[] } {
  const q = String(input.question ?? "").trim();
  const issues: BootstrapQuestionQualityIssueCode[] = [];
  if (!q) return { ok: false, issues: ["missing_domain_anchor"] };

  const proposalFirst = hasProposalFirstStructure(q);
  if (detectQuestionFirstUx(q) && !proposalFirst) issues.push("question_first_ux");

  if (detectInternalOrchestrationVocabInUserQuestion(q)) issues.push("internal_orchestration_vocab_question");

  /** 공문·SI 요구사항 정의서식 질문체 */
  if (/책임은\s*누구에게\s*있나요|책임(?:분기)?은\s*누구에게\s*있나요/.test(q)) issues.push("document_interview_tone");

  const hitLabels = BOOTSTRAP_SLOT_LABEL_BANNED_PHRASES.filter((p) => q.includes(p));
  if (hitLabels.length >= 2) issues.push("multi_slot_question");
  if (hitLabels.length >= 1) issues.push("slot_label_question");

  const hasDomainLex =
    BOOTSTRAP_QUESTION_DOMAIN_LEXEMES.some((w) => q.includes(w)) ||
    BOOTSTRAP_QUESTION_DOMAIN_LEXEMES.some((w) => String(input.projectDescription ?? "").includes(w));
  if (!proposalFirst && !hasDomainLex) issues.push("missing_domain_anchor");

  const qMarks = (q.match(/\?|？/g) ?? []).length;
  if (qMarks >= 2) issues.push("multi_question_marks");

  const genericWhat = /무엇인가요|뭔가요|무엇을|뭘\s/.test(q);
  if (!proposalFirst && genericWhat && !DECISION_AXIS_RE.test(q)) issues.push("generic_what_only");

  if (!proposalFirst && hasDomainLex && !DECISION_AXIS_RE.test(q)) issues.push("weak_decision_axis");

  const unique = [...new Set(issues)];
  return { ok: unique.length === 0, issues: unique };
}

/**
 * LLM·재시도 실패 시: 프로젝트 설명·부트스트랩 메타에서 한 문장 decision 질문을 구성(도메인별 하드코딩 테이블 없음).
 */
export function repairBootstrapQuestionFromContext(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly orchestrationBootstrap?: {
    readonly detectedDomain?: string | null;
    readonly recommendedFocus?: string | null;
    readonly primaryDecisionAxis?: string | null;
  } | null;
}): string {
  const name = input.projectName.trim() || "이 서비스";
  const desc = String(input.projectDescription ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const focus =
    String(input.orchestrationBootstrap?.recommendedFocus ?? "").trim() ||
    String(input.orchestrationBootstrap?.detectedDomain ?? "").trim() ||
    "";
  const lexFromDesc = BOOTSTRAP_QUESTION_DOMAIN_LEXEMES.find((w) => desc.includes(w)) ?? null;
  const topic = focus || (desc.length >= 8 ? desc.slice(0, 72).trim() : "");
  const axis = String(input.orchestrationBootstrap?.primaryDecisionAxis ?? "")
    .trim()
    .toLowerCase();
  const lead = lexFromDesc ? `${name}에서 ${lexFromDesc}가 나온 뒤, ` : topic ? `${name}(${topic}) 기준으로, ` : `${name}에서, `;

  if (axis.includes("automation") || axis.includes("batch") || axis.includes("realtime") || axis.includes("quality")) {
    return `${lead}어디까지는 자동으로 돌리고, 어디부터는 사람이 확인하면 좋을까요?`;
  }
  if (axis.includes("collaboration") || axis.includes("workflow")) {
    return `${lead}협업으로 같이 검토·수정하는 흐름이 필요할까요, 아니면 작성자가 주도해서 정리하면 될까요?`;
  }
  if (axis.includes("prototype") || axis.includes("boundary")) {
    return `${lead}다음처럼 초안을 잡아 보았습니다.

예상 범위(초안):
- 핵심 흐름만 구현
- 검토·수정 화면 포함
- 고급 자동화·연동은 이후

위 범위가 맞는지 선택하거나 수정해 주세요.`;
  }

  return `${lead}다음처럼 이해했습니다.

예상 흐름(초안):
1. 입력·업로드
2. 자동 처리·가공
3. 검토·수정
4. 확정·공유

예상 참여 역할(초안):
- 주 작성자
- 협업 참여자
- 관리자

위 초안이 맞는지 선택하거나 수정해 주세요.`;
}

export function buildBootstrapQuestionRetryUserPayload(input: {
  readonly issues: readonly BootstrapQuestionQualityIssueCode[];
  readonly rejectedQuestion: string;
}): string {
  const internalUx = input.issues.includes("internal_orchestration_vocab_question");
  const docTone = input.issues.includes("document_interview_tone");
  const questionFirst = input.issues.includes("question_first_ux");
  const lines = [
    "[QUALITY_RETRY]",
    "이전 JSON의 question이 아래 정책을 위반했습니다. 동일 스키마로 JSON 전체를 다시 출력하세요.",
    `위반 이슈 코드: ${input.issues.join(", ")}`,
    `거절된 question: ${input.rejectedQuestion.slice(0, 400)}`,
    "",
    "[사용자 업무 언어 변환]",
    "- orchestrationBootstrap.primaryDecisionAxis 등 내부 축 이름은 메타데이터로만 두고, question에는 한글 업무 대화체로만 쓸 것.",
    "- 승인 책임·자동화 수준·prototype boundary·workflow branching 같은 내부 식별어·영문 축 id를 question에 넣지 말 것.",
    "- 실제 상황: 누가 확인·수정하는지, 어떤 순서로 진행되는지, 어디까지 자동인지를 묻는 한 문장으로 바꿀 것.",
    ...(internalUx || docTone
      ? [
          "",
          "[이번 재시도 필수]",
          "- 내부 오케스트레이션 축 메타는 orchestrationBootstrap에만 두고, question은 회의실·업무 현장에서 묻는 말투로 다시 작성할 것.",
        ]
      : []),
    ...(questionFirst
      ? [
          "",
          "[question-first 거절]",
          "- question 필드를 proposal-first 메시지로 다시 작성할 것(예상 흐름 번호 목록 + 예상 액터 불릿 + 수정·선택 CTA).",
        ]
      : []),
    "",
    "반드시 (proposal-first):",
    "- question 필드는 코디네이터 **첫 제안 메시지** 전체(이해 1~2줄 + 예상 흐름/액터/단계 초안 + 추천 1줄 + 수정·선택 CTA)",
    "- '첫 단계는 무엇입니까?', '어떤 액터가 필요하신가요?' 같은 빈 설계 질문 금지",
    "- 물음표는 최대 1개(마지막 확인용만)",
    "- 회의록·녹취·화자·요약·검토·수정·확정·자동화·협업 중 프로젝트에 맞는 어절 포함",
    "",
    "금지:",
    "- phase1 슬롯 라벨을 question에 직접 넣기",
    "- 두 개 이상의 슬롯 주제를 한 메시지에 묶기",
    "- 설명에 이미 적힌 사실만 되묻기",
    "- question-first(사용자가 처음부터 설계하게 만드는 질문만 던지기)",
  ];
  return lines.join("\n");
}

export function filterBootstrapInterviewSuggestions(input: {
  readonly suggestions: readonly string[];
  readonly question: string;
}): {
  readonly suggestions: readonly string[];
  readonly issues: readonly string[];
  readonly fallbackGeneratedSuggestions: boolean;
} {
  const issues: string[] = [];
  const q = String(input.question ?? "").trim();
  const out: string[] = [];
  const reviewish = /검토|확정|수정|승인|자동|공동|참가|작성|초안|확인/.test(q);

  const defaultReviewChips = [
    "작성자만 최종 확정",
    "참석자랑 같이 고친 뒤 확정",
    "AI 초안만 만들고 사람이 검토",
    "바로 쓰기(별도 확정 없음)",
  ];

  for (const raw of input.suggestions) {
    const s = String(raw ?? "").trim();
    if (!s || s.length > 80) continue;
    if (META_SUGGESTION_BANNED.some((b) => s.includes(b))) {
      issues.push(`meta_suggestion:${s.slice(0, 40)}`);
      continue;
    }
    if (GENERIC_ROLE_OR_META_SUGGESTION_SUBSTRINGS.some((b) => s.includes(b))) {
      issues.push(`generic_role_suggestion:${s.slice(0, 40)}`);
      continue;
    }
    if (BOOTSTRAP_SLOT_LABEL_BANNED_PHRASES.some((p) => s.includes(p))) {
      issues.push(`slot_label_suggestion:${s.slice(0, 40)}`);
      continue;
    }
    out.push(s);
  }

  let merged = [...new Set(out)].slice(0, 6);
  let fallbackGeneratedSuggestions = false;
  if (reviewish && merged.length < 3) {
    const before = merged.length;
    for (const c of defaultReviewChips) {
      if (merged.length >= 4) break;
      if (!merged.includes(c)) merged.push(c);
    }
    merged = merged.slice(0, 6);
    if (merged.length > before) {
      fallbackGeneratedSuggestions = true;
      issues.push("fallback_generated_suggestions:workflow_chips");
    }
  }

  return { suggestions: merged, issues, fallbackGeneratedSuggestions };
}
