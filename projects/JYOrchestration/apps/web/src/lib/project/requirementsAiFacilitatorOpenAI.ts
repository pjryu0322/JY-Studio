import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { IdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import type { InterviewAnalyzerPayload, ProblemInterviewState } from "@/lib/requirements/problemInterview";
import { parseInterviewAnalyzerPayloadFromModelText, problemInterviewStateToAnalyzerWire } from "@/lib/requirements/problemInterview";
import { isProblemInterviewSlot } from "@/lib/requirements/problemInterview";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildIdeationDeliverableBasePrompt,
  buildIdeationDeliverablesUserPrompt,
  extractIdeationDeliverableOutputsFromRoot,
  stripJsonMarkdownFences,
} from "@/lib/requirements/ideationDeliverables";
import { normalizeLlmInterviewSuggestions } from "@/lib/requirements/interviewSuggestionChips";
import {
  analyzeBootstrapQuestionQuality,
  buildBootstrapQuestionRetryUserPayload,
  filterBootstrapInterviewSuggestions,
  repairBootstrapQuestionFromContext,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import { formatBootstrapAxisRotationBlock } from "@/lib/requirements/requirementsBootstrapOrchestrationHints";
import type { OrganizeMemoryFacts } from "@/lib/requirements/requirementsOrganizeContext";
import { formatMandatoryReminderForModel, formatMemoryFactsForModel } from "@/lib/requirements/requirementsOrganizeContext";

export type RequirementsAiResponseStyle = "brief" | "standard" | "detailed";

export type RequirementsFacilitatorOpenAiResult =
  | {
      ok: true;
      text: string;
      model: string;
      promptText?: string;
      provider?: string;
      calledAt?: string;
      /** 인터뷰 유도형 선택지(참고용) */
      interviewSuggestions?: string[];
      interviewAllowCustomInput?: boolean;
    }
  | { ok: false; code: string; message: string };

export type OrchestrationBootstrapInitializerWire = Readonly<{
  detectedDomain?: string | null;
  missingInformation?: string[];
  recommendedFocus?: string | null;
  interactionMode?: string | null;
  initialOwnershipHints?: Array<{ slotKey: string; ownerAgent: string }>;
  primaryDecisionAxis?: string | null;
  selectedQuestionAxis?: string | null;
  reasoningContributors?: readonly string[];
  riskSignals?: readonly string[];
  /** 사용자 대면 질문 스타일 태그(내부 메타; 하드코딩 질문 아님) */
  userFacingQuestionStyle?: string | null;
}>;

export type RequirementsSingleChatBootstrapSuggestedSlot = {
  slotKey: string;
  title: string;
  description: string;
  ownerAgent: "planner" | "analyst" | "architect" | "designer" | "reviewer" | "security";
  reason?: string | null;
  priority?: "high" | "medium" | "low" | null;
  proposalConfidence?: number | null;
};

export type BootstrapQuestionQualityStatus = "pass" | "retry_passed" | "retry_failed_repaired";

export type RequirementsSingleChatBootstrapOpenAIResult =
  | {
      ok: true;
      question: string;
      suggestions: string[];
      allowCustomInput: boolean;
      suggestedSlots: RequirementsSingleChatBootstrapSuggestedSlot[];
      orchestrationBootstrap?: OrchestrationBootstrapInitializerWire;
      suggestedSlotReasons?: ReadonlyArray<{ slotKey: string; reason: string }>;
      model: string;
      promptText: string;
      provider: string;
      calledAt: string;
      questionQualityStatus: BootstrapQuestionQualityStatus;
      questionQualityIssues: readonly string[];
      questionQualityRetryCount: number;
      finalQuestionSource: "llm" | "llm_retry" | "repaired_context";
      suggestionQualityIssues?: readonly string[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      /** 실패해도 추적성을 위해 LLM 호출 메타는 보존한다(호출 자체가 실패한 경우는 비어 있을 수 있음). */
      model?: string;
      promptText?: string;
      provider?: string;
      calledAt?: string;
      responseText?: string;
    };

function extractSingleChatBootstrapFromJson(j: Record<string, unknown>): {
  question: string;
  suggestions: string[];
  allowCustomInput: boolean;
  suggestedSlots: RequirementsSingleChatBootstrapSuggestedSlot[];
  orchestrationBootstrap?: OrchestrationBootstrapInitializerWire;
  suggestedSlotReasons: ReadonlyArray<{ slotKey: string; reason: string }>;
} {
  const question = String(
    j.question ?? j.interviewQuestion ?? j.questionText ?? j.q ?? j.text ?? j.reply ?? ""
  ).trim();
  let suggestions: string[] = [];
  if (Array.isArray(j.suggestions)) {
    suggestions = normalizeLlmInterviewSuggestions(j.suggestions.map((x) => String(x ?? "")));
  }
  let allowCustomInput = true;
  if (j.allowCustomInput === false) allowCustomInput = false;
  let suggestedSlots: RequirementsSingleChatBootstrapSuggestedSlot[] = [];
  if (Array.isArray(j.suggestedSlots)) {
    suggestedSlots = (j.suggestedSlots as unknown[])
      .map((x): RequirementsSingleChatBootstrapSuggestedSlot | null => {
        if (!x || typeof x !== "object") return null;
        const r = x as Record<string, unknown>;
        const slotKey = String(r.slotKey ?? "").trim();
        const title = String(r.title ?? "").trim();
        const description = String(r.description ?? "").trim();
        const ownerAgent = String(r.ownerAgent ?? "").trim().toLowerCase();
        if (!slotKey || !title || !description || !ownerAgent) return null;
        const owner =
          ownerAgent === "planner" ||
          ownerAgent === "analyst" ||
          ownerAgent === "architect" ||
          ownerAgent === "designer" ||
          ownerAgent === "reviewer" ||
          ownerAgent === "security"
            ? (ownerAgent as RequirementsSingleChatBootstrapSuggestedSlot["ownerAgent"])
            : null;
        if (!owner) return null;
        const reason = typeof r.reason === "string" ? r.reason.slice(0, 200) : r.reason === null ? null : null;
        const priorityRaw = String(r.priority ?? "").trim().toLowerCase();
        const priority =
          priorityRaw === "high" || priorityRaw === "medium" || priorityRaw === "low" ? (priorityRaw as any) : null;
        const proposalConfidence =
          r.proposalConfidence !== null && r.proposalConfidence !== undefined && Number.isFinite(Number(r.proposalConfidence))
            ? Math.min(1, Math.max(0, Number(r.proposalConfidence)))
            : null;
        return { slotKey, title, description, ownerAgent: owner, reason, priority, proposalConfidence };
      })
      .filter((x): x is RequirementsSingleChatBootstrapSuggestedSlot => x !== null);
  }
  const suggestedSlotReasons = suggestedSlots
    .filter((s) => typeof s.reason === "string" && String(s.reason).trim())
    .map((s) => ({ slotKey: s.slotKey, reason: String(s.reason).trim().slice(0, 220) }));
  let orchestrationBootstrap: OrchestrationBootstrapInitializerWire | undefined = undefined;
  if (j.orchestrationBootstrap && typeof j.orchestrationBootstrap === "object") {
    const ob = j.orchestrationBootstrap as Record<string, unknown>;
    const detectedDomain = typeof ob.detectedDomain === "string" ? ob.detectedDomain.slice(0, 80) : null;
    const recommendedFocus = typeof ob.recommendedFocus === "string" ? ob.recommendedFocus.slice(0, 120) : null;
    const interactionMode = typeof ob.interactionMode === "string" ? ob.interactionMode.slice(0, 80) : null;
    const missingInformation = Array.isArray(ob.missingInformation)
      ? ob.missingInformation.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 10)
      : [];
    const initialOwnershipHints = Array.isArray(ob.initialOwnershipHints)
      ? ob.initialOwnershipHints
          .map((x) => {
            if (!x || typeof x !== "object") return null;
            const r = x as Record<string, unknown>;
            const slotKey = String(r.slotKey ?? r.slotId ?? "").trim();
            const ownerAgent = String(r.ownerAgent ?? "").trim().toLowerCase();
            if (!slotKey || !ownerAgent) return null;
            return { slotKey: slotKey.slice(0, 120), ownerAgent: ownerAgent.slice(0, 60) };
          })
          .filter((x): x is { slotKey: string; ownerAgent: string } => x !== null)
          .slice(0, 12)
      : [];
    const primaryDecisionAxis =
      typeof ob.primaryDecisionAxis === "string" ? ob.primaryDecisionAxis.trim().slice(0, 80) : null;
    const selectedQuestionAxis =
      typeof ob.selectedQuestionAxis === "string" ? ob.selectedQuestionAxis.trim().slice(0, 80) : null;
    const contribAllowed = new Set(["planner", "analyst", "architect", "designer", "reviewer", "security"]);
    const reasoningContributors = Array.isArray(ob.reasoningContributors)
      ? ob.reasoningContributors
          .map((x) => String(x ?? "").trim().toLowerCase())
          .filter((x) => contribAllowed.has(x))
          .slice(0, 8)
      : [];
    const riskSignals = Array.isArray(ob.riskSignals)
      ? ob.riskSignals.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 12)
      : [];
    const userFacingQuestionStyle =
      typeof ob.userFacingQuestionStyle === "string" ? ob.userFacingQuestionStyle.trim().slice(0, 80) : null;
    orchestrationBootstrap = {
      detectedDomain,
      recommendedFocus,
      ...(interactionMode ? { interactionMode } : {}),
      ...(missingInformation.length ? { missingInformation } : {}),
      ...(initialOwnershipHints.length ? { initialOwnershipHints } : {}),
      ...(primaryDecisionAxis ? { primaryDecisionAxis } : {}),
      ...(selectedQuestionAxis ? { selectedQuestionAxis } : {}),
      ...(reasoningContributors.length ? { reasoningContributors } : {}),
      ...(riskSignals.length ? { riskSignals } : {}),
      ...(userFacingQuestionStyle ? { userFacingQuestionStyle } : {}),
    };
  }
  return { question, suggestions, allowCustomInput, suggestedSlots, orchestrationBootstrap, suggestedSlotReasons };
}

function facilitatorResponseStyleAddendum(style: RequirementsAiResponseStyle | undefined): string {
  const s = style === "brief" || style === "detailed" ? style : "standard";
  if (s === "standard") return "";
  if (s === "brief") {
    return `\n\n[응답 길이 선호 — 사용자 설정: 간단히]\n- 문장 수를 줄이고, 한두 가지 확인 질문에 집중합니다.\n- 기본 8문장 이내 규칙보다 더 짧게 써도 됩니다.`;
  }
  return `\n\n[응답 길이 선호 — 사용자 설정: 상세히]\n- 맥락·옵션·트레이드오프를 풀어 설명해도 됩니다.\n- 필요하면 단계별로 나열합니다.`;
}

function draftResponseStyleAddendum(style: RequirementsAiResponseStyle | undefined): string {
  const s = style === "brief" || style === "detailed" ? style : "standard";
  if (s === "standard") return "";
  if (s === "brief") {
    return `\n[추가 규칙 — 응답 스타일: 간단히]\n- overview·각 배열 항목은 짧은 구문 위주로 유지합니다.`;
  }
  return `\n[추가 규칙 — 응답 스타일: 상세히]\n- overview와 항목 설명을 조금 더 구체적으로 작성해도 됩니다.`;
}

export type RequirementsDraftOpenAiResult =
  | {
      ok: true;
      draft: {
        overview: string;
        goals: string[];
        users: string[];
        features: string[];
        excluded: string[];
        nonFunctional: string[];
        successCriteria: string[];
        openIssues: string[];
      };
      model: string;
    }
  | { ok: false; code: string; message: string };

/**
 * 요구사항 협의실용 OpenAI 호출(서버 전용). OPENAI_MODEL 미설정 시 gpt-4o-mini.
 */
export async function runRequirementsFacilitatorOpenAI(input: {
  projectName: string;
  projectDescription: string;
  stage: "requirements";
  userMessage: string;
  dialogueExcerpt: string;
  /** 질문 대상 멤버(복수) — 모델 맥락용 */
  mentionTargetsSummary?: string;
  /** 전송 메타(감사·디버그용, 본문에만 포함) */
  senderSummary?: string;
  /** 클라이언트 전역 설정과 동기 */
  responseStyle?: RequirementsAiResponseStyle;
  /** 직전 화면 전환 시 넘겨받은 맥락(세션에서 1회 소비) */
  priorScreenHandoff?: string;
  /** AI Agent 설정 절차별 참여 Agent 블록(서버에서 생성) */
  participatingAgentsPromptBlock?: string;
}): Promise<RequirementsFacilitatorOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = resolveOpenAiModelFromEnv();
  const excerpt = input.dialogueExcerpt.trim().slice(0, 24_000);
  const projectName = input.projectName.trim();
  const projectDescription = input.projectDescription.trim();
  const mentionBlock = (input.mentionTargetsSummary ?? "").trim()
    ? `\n\n[질문 대상 멤버]\n${(input.mentionTargetsSummary ?? "").trim()}`
    : "";
  const senderBlock = (input.senderSummary ?? "").trim()
    ? `\n\n[발신]\n${(input.senderSummary ?? "").trim()}`
    : "";
  const handoffBlock = (input.priorScreenHandoff ?? "").trim()
    ? `\n\n[이전 화면에서 넘어온 맥락]\n${(input.priorScreenHandoff ?? "").trim().slice(0, 4000)}`
    : "";

  const agentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n\n${(input.participatingAgentsPromptBlock ?? "").trim()}\n`
    : "";

  const systemContent = `${workspaceAiMemberSystemPrefix("ideation")}${agentInsert}역할: 범위·모호함·누락·역할·기능/비기능 요구를 짧게 질문하고, 확인 가능한 요구사항으로 수렴시키세요.
규칙:
- 한국어로 답합니다.
- 1회 응답은 8문장 이내, 불필요한 서론·마크다운 제목 없이 대화체로 작성합니다.
- (아이디어 구체화) 이번 응답에는 확인 질문을 정확히 1개만 넣습니다. 둘째 이후 질문·번호 목록·여러 물음표 나열은 금지입니다.
- 가능하면 1~2문장으로 핵심 이해를 짧게 쓴 뒤, 질문 1개만 제시합니다. 짧은 이유는 최대 한 문장까지 선택입니다.
- 사용자가 특정 참가자에게 질문한 맥락이 있으면 그에 맞춰 답합니다.${facilitatorResponseStyleAddendum(input.responseStyle)}`;

  const userContent = `다음 정보를 알고 있다고 가정하고 답하세요. "어떤 프로젝트인가요?"처럼 프로젝트를 모르는 질문은 금지합니다.

[프로젝트]
- 이름: ${projectName || "(이름 없음)"}
- 설명: ${projectDescription || "(설명 없음)"}

[현재 단계]
- Requirements(요구사항)${handoffBlock}

[최근 대화 발췌]
${excerpt || "(이전 메시지 없음)"}

[이번 사용자 메시지]
${input.userMessage.trim()}${mentionBlock}${senderBlock}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.35,
  });

  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}`,
    };
  }

  const text = res.text;
  if (!text) {
    return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
  }

  const promptText = `[system]\n${systemContent}\n\n---\n\n[user]\n${userContent}`;
  return { ok: true, text, model, promptText, provider: "openai", calledAt: new Date().toISOString() };
}

/**
 * 아이디어 구체화: 대화가 비어 있을 때 전담 AI(기획)가 인터뷰 첫 질문만 던지도록 부트스트랩.
 * 일반 요구사항 대화용 프롬프트와 분리해, 질문 1개·설명 금지 규칙을 강하게 둡니다.
 */
export async function runRequirementsIdeationInterviewBootstrapOpenAI(input: {
  projectName: string;
  projectDescription: string;
  projectType?: string | null;
  participatingAgentsPromptBlock?: string;
  /** SingleChat 오케스트레이션 — planner 우선 첫 질문 규칙 */
  orchestrationBootstrapInstructions?: string;
}): Promise<RequirementsFacilitatorOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = resolveOpenAiModelFromEnv();
  const pn = input.projectName.trim() || "(이름 없음)";
  const pd = input.projectDescription.trim() || "(설명 없음)";
  const pt = String(input.projectType ?? "").trim() || "(유형 미지정)";

  const agentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n\n${(input.participatingAgentsPromptBlock ?? "").trim()}\n\n`
    : "\n\n";

  const orchInsert = (input.orchestrationBootstrapInstructions ?? "").trim()
    ? `${String(input.orchestrationBootstrapInstructions).trim()}\n\n`
    : "";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${agentInsert}${orchInsert}당신은 숙련된 서비스 기획자입니다.

목표:
사용자의 프로젝트 아이디어를 구체화하기 위해
통합 기획안(단일 문서) 작성 전 인터뷰를 진행하십시오.

프로젝트명:
${pn}

프로젝트 설명:
${pd}

프로젝트 유형:
${pt}

지시사항:
1. 위 세 필드를 반드시 반영해 프로젝트를 한 줄로 요약한 뒤(본문 출력 금지 — 내부 추론만), 사용자에게 필요한 정보를 묻는다.
2. 부족한 핵심 정보를 찾으라.
3. 가장 중요한 질문 1개만 하라.
4. 여러 질문 동시 금지.
5. 답변 후 후속 질문으로 좁혀가라.
6. 질문은 반드시 프로젝트명·설명·유형에 구체적으로 연결된 맞춤형이어야 한다. "어떤 서비스를 만들고 싶으신가요?" 같은 일반 질문만 출력하는 것은 금지다.
7. 최종적으로 아래가 모두 드러나도록 순차적으로 물어라(한 번에 다 묻지 말 것):

- 무엇을 만들고 싶은가(serviceIdea)
- 주 사용자는 누구인가(targetUser)
- 가장 큰 문제는 무엇인가(coreProblem)
- 어떻게 개선되길 원하는가(expectedOutcome)
- 개략 액터는 무엇인가(roughActors)
- 개략 흐름은 무엇인가(roughFlow)
- 핵심 기능 3개 내외는 무엇인가(mustHaveFeatures)
- 큰 제약사항이 있는가(constraints)

지금 첫 질문을 시작하라.

IMPORTANT:
- question 필드에는 질문 한 문장만(? 하나).
- suggestions는 3~6개, 프로젝트명·설명·유형과 직접 연관된 짧은 선택지(참고용, 강제 아님).
- 프로젝트와 무관한 업종/역할(예: 배달 기사, 쇼핑몰 관리자)을 임의로 넣지 마라.

[출력 — JSON 한 개만, 마크다운·코드펜스 금지]
{
  "question": "한국어 질문 한 문장",
  "suggestions": ["선택지1", "선택지2"],
  "allowCustomInput": true
}`;
  const user = "위 JSON만 출력하라.";
  const calledAt = new Date().toISOString();
  const promptText = `[system]\n${system}\n\n---\n\n[user]\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    maxTokens: 220,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}`,
    };
  }

  const text = res.text;
  if (!text) {
    return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
  }

  let questionOut = "";
  let interviewSuggestions: string[] | undefined;
  let allowCustomInput = true;
  try {
    const raw = stripJsonMarkdownFences(String(text).trim());
    const j = JSON.parse(raw) as Record<string, unknown>;
    questionOut = String(j.question ?? "").trim();
    if (Array.isArray(j.suggestions)) {
      const s = normalizeLlmInterviewSuggestions(j.suggestions.map((x) => String(x ?? "")));
      if (s.length) interviewSuggestions = s;
    }
    if (j.allowCustomInput === false) allowCustomInput = false;
  } catch {
    questionOut = String(text).trim();
  }
  if (!questionOut) {
    return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
  }

  return {
    ok: true,
    text: questionOut,
    model,
    promptText,
    provider: "openai",
    calledAt,
    ...(interviewSuggestions?.length ? { interviewSuggestions } : {}),
    interviewAllowCustomInput: allowCustomInput,
  };
}

/**
 * SingleChat bootstrap: 첫 질문 + suggestion chips + dynamic slot proposal.
 * 질문 품질 미달 시 최대 1회 재시도 후, 필요하면 프로젝트 맥락 기반 보정 질문으로 대체한다.
 */
export async function runRequirementsSingleChatBootstrapOpenAI(input: {
  projectName: string;
  projectDescription: string;
  projectType?: string | null;
  participatingAgentsPromptBlock?: string;
  orchestrationBootstrapInstructions?: string;
  /**
   * Bootstrap용 슬롯 카탈로그 JSON(Phase1 compact; dependsOn·전체 계층 키 없음).
   * @see stringifyCompactBootstrapSlotCatalogForLlm
   */
  baseSlotCatalogJson: string;
}): Promise<RequirementsSingleChatBootstrapOpenAIResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }

  const model = resolveOpenAiModelFromEnv();
  const pn = input.projectName.trim() || "(이름 없음)";
  const pd = input.projectDescription.trim() || "(설명 없음)";
  const pt = String(input.projectType ?? "").trim() || "(유형 미지정)";
  const baseCatalog = String(input.baseSlotCatalogJson ?? "").trim();

  const agentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n\n${(input.participatingAgentsPromptBlock ?? "").trim()}\n\n`
    : "\n\n";

  const orchInsert = (input.orchestrationBootstrapInstructions ?? "").trim()
    ? `${String(input.orchestrationBootstrapInstructions).trim()}\n\n`
    : "";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${agentInsert}${orchInsert}[BOOTSTRAP — multi-agent orchestration initializer]
역할: planner/analyst/architect/(designer) 관점을 혼합해 상태 초기 추론·dyn 슬롯(필요 시)·첫 질문 1개(question)를 산출한다.
참여 AI 블록의 역할 문자열은 외부 6종(planner/analyst/architect/designer/reviewer/security)만 사용한다.

[bootstrap reasoning mode]
질문 생성 전에 내부적으로 planner·analyst·architect 관점을 모두 검토한 뒤, 프로젝트에서 가장 중요한 orchestration decision 축 하나를 고른다.
question은 단순 정보 수집이 아니라 현재 프로젝트의 핵심 설계 분기를 드러내야 한다.

question 선택 우선순위(내부, 단일 축만 출력):
1 workflow branching 2 collaboration boundary 3 approval responsibility 4 automation level 5 quality validation 6 prototype boundary 7 editing authority 8 realtime vs batch — 동일 서비스 목적 재질문 금지.

질문 정책(orchestration-first):
- [phase1_slot_catalog]의 label 문자열을 question에 그대로 넣지 말 것.
- 한 질문에는 하나의 판단축만(물음표 1개·한 문장).
- 프로젝트 설명에 이미 적힌 사실을 되묻지 말 것.
- question에는 도메인 실행 단어 최소 1개: 회의록·녹취·화자·요약·검토·수정·확정·자동화·실시간·배치·협업·산출물 중 하나(프로젝트 설명에 없으면 산출물·흐름을 자연어로 특정).

architect 관점: 자동화·품질·수정 허용·처리 속도·업로드·연동 한도 등 분기를 후보에 포함한다(단, question에는 이런 내부 라벨을 그대로 넣지 말 것).

[question language policy]
- question은 사용자 업무 대화체로만 작성한다. 문서/SI 요구사항 인터뷰·정책서 문체 금지.
- primaryDecisionAxis 등 내부 축 이름·영문 축 id·승인 책임·자동화 수준·prototype boundary 같은 오케스트레이션 용어를 question에 쓰지 말 것. 축은 orchestrationBootstrap 메타에만 둔다.
- 실제로 일이 돌아가는 그림: 누가 확인/수정하는지, 어떤 순서로 진행되는지, 어디까지 자동인지, 누가 같이 볼지.
- “~의 책임은 누구에게 있나요?” 류 딱딱한 질문보다, “누가 최종 확인하나요?”, “참석자도 같이 고칠 수 있어야 하나요?” 같은 말투.

[orchestration axis → 사용자 언어 (정책 예시 — 하드코딩 질문 테이블 아님)]
- approval-responsibility → 누가 최종 확인·확정하는지
- workflow-branching → 어떤 순서/분기로 진행되는지
- automation-level → AI·시스템이 어디까지 자동으로 처리하는지
- collaboration-boundary → 누가 함께 검토·편집하는지
- quality-validation → 사람이 직접 볼지·자동으로 걸러낼지
- prototype-boundary → 첫 버전에서 어디까지 만들지

[suggestions policy]
- 프로젝트 매니저·개발 팀·팀 리더 같은 조직 역할 라벨 금지.
- 실제 행동·흐름 선택지: 작성자만 확정 / 참석자와 함께 수정 후 확정 / AI 초안 후 사람 검토 / 바로 사용 등.

suggestions: 사용자가 바로 탭할 구체 선택지. 메타 문구 금지.

suggestedSlots:
- 기본 phase1 슬롯만으로 orchestration 리스크를 커버하면 [].
- 부족할 때만 dyn_ 0~3. 각 항목에 reason 필수: 어떤 리스크·분기를 해결하는지 orchestration 관점에서 한 줄.
dyn 규칙: slotKey=dyn_* , ownerAgent ∈ {planner,analyst,architect,designer,reviewer,security}, title≤40자, description≤140자, priority, proposalConfidence 0~1.

orchestrationBootstrap에 반드시 포함:
- reasoningContributors: 위 관점 검토에 실제로 참여한 외부 역할 배열(예: ["planner","analyst","architect"])
- primaryDecisionAxis: 이번 질문의 단일 축 식별자(예: automation-level, collaboration-boundary) — 내부 전용
- selectedQuestionAxis: primary와 동일해도 됨
- userFacingQuestionStyle: 사용자에게 보이는 질문 톤 태그(예: workflow-confirmation, automation-scope) — 질문 하드코딩 아님
- riskSignals: 짧은 토큰 배열(예: multi-user-collaboration)

JSON 스키마(마크다운·코드펜스 금지 — 예시 문장은 도메인 특정 금지, 플레이스홀더만):
{
  "question": "다음 설계 판단에 필요한 한국어 질문 한 문장",
  "suggestions": ["작성자만 최종 확정", "참석자와 함께 수정 후 확정"],
  "allowCustomInput": true,
  "orchestrationBootstrap": {
    "detectedDomain": "…",
    "missingInformation": ["…"],
    "recommendedFocus": "…",
    "interactionMode": "collaborative-review|auto-approve|mixed|unknown",
    "initialOwnershipHints": [{ "slotId": "planning.servicePurpose", "ownerAgent": "planner" }],
    "primaryDecisionAxis": "workflow-branching",
    "selectedQuestionAxis": "workflow-branching",
    "userFacingQuestionStyle": "flow-branch",
    "reasoningContributors": ["planner", "analyst", "architect"],
    "riskSignals": ["approval-boundary"]
  },
  "suggestedSlots": []
}`;

  const axisBlock = formatBootstrapAxisRotationBlock({ projectName: pn, projectDescription: pd });

  const user = `[project]
name: ${pn}
type: ${pt}
description: ${pd.slice(0, 1400)}

${axisBlock}

[phase1_slot_catalog]
${baseCatalog.slice(0, 6000)}

위 JSON만 출력.`;

  const calledAt = new Date().toISOString();
  const promptText = `[system]\n${system}\n\n---\n\n[user]\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    maxTokens: 520,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}`,
      model,
      promptText,
      provider: "openai",
      calledAt,
    };
  }
  const text = res.text;
  if (!text) {
    return {
      ok: false,
      code: "EMPTY",
      message: "OpenAI 응답 본문이 비어 있습니다.",
      model,
      promptText,
      provider: "openai",
      calledAt,
      responseText: "",
    };
  }

  let assistantRaw: string;
  let payload: ReturnType<typeof extractSingleChatBootstrapFromJson>;
  try {
    assistantRaw = stripJsonMarkdownFences(String(text).trim());
    const j = JSON.parse(assistantRaw) as Record<string, unknown>;
    payload = extractSingleChatBootstrapFromJson(j);
  } catch {
    return {
      ok: false,
      code: "PARSE",
      message: "bootstrap JSON 파싱 실패",
      model,
      promptText,
      provider: "openai",
      calledAt,
      responseText: String(text).slice(0, 20_000),
    };
  }

  if (!payload.question) {
    return {
      ok: false,
      code: "EMPTY",
      message: "question이 비어 있습니다.",
      model,
      promptText,
      provider: "openai",
      calledAt,
      responseText: String(text).slice(0, 20_000),
    };
  }

  let promptTextOut = promptText;
  let questionQualityRetryCount = 0;
  let questionQualityStatus: BootstrapQuestionQualityStatus;
  let questionQualityIssues: string[] = [];
  let finalQuestionSource: "llm" | "llm_retry" | "repaired_context" = "llm";

  const q0 = analyzeBootstrapQuestionQuality({ question: payload.question, projectDescription: pd });
  if (q0.ok) {
    questionQualityStatus = "pass";
    questionQualityIssues = [];
  } else {
    const firstIssues = q0.issues.map(String);
    questionQualityRetryCount = 1;
    const retryUser = buildBootstrapQuestionRetryUserPayload({
      issues: q0.issues,
      rejectedQuestion: payload.question,
    });
    promptTextOut = `${promptText}\n\n--- bootstrap_question_retry ---\n${retryUser}`;

    const res2 = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
        { role: "assistant", content: assistantRaw },
        { role: "user", content: retryUser },
      ],
      temperature: 0.2,
      maxTokens: 520,
      responseFormatJsonObject: true,
    });

    if (res2.ok && res2.text) {
      try {
        const raw2 = stripJsonMarkdownFences(String(res2.text).trim());
        const j2 = JSON.parse(raw2) as Record<string, unknown>;
        const p2 = extractSingleChatBootstrapFromJson(j2);
        if (p2.question) {
          assistantRaw = raw2;
          payload = {
            ...p2,
            orchestrationBootstrap: {
              ...(payload.orchestrationBootstrap ?? {}),
              ...(p2.orchestrationBootstrap ?? {}),
            },
          };
        }
      } catch {
        /* keep first payload */
      }
    }

    const q1 = analyzeBootstrapQuestionQuality({ question: payload.question, projectDescription: pd });
    if (q1.ok) {
      questionQualityStatus = "retry_passed";
      questionQualityIssues = firstIssues;
      finalQuestionSource = "llm_retry";
    } else {
      payload = {
        ...payload,
        question: repairBootstrapQuestionFromContext({
          projectName: pn,
          projectDescription: pd,
          orchestrationBootstrap: payload.orchestrationBootstrap ?? null,
        }),
      };
      questionQualityStatus = "retry_failed_repaired";
      questionQualityIssues = [...new Set([...firstIssues, ...q1.issues.map(String)])];
      finalQuestionSource = "repaired_context";
    }
  }

  const sugPack = filterBootstrapInterviewSuggestions({
    suggestions: payload.suggestions,
    question: payload.question,
  });

  return {
    ok: true,
    question: payload.question,
    suggestions: [...sugPack.suggestions],
    allowCustomInput: payload.allowCustomInput,
    suggestedSlots: payload.suggestedSlots,
    ...(payload.orchestrationBootstrap ? { orchestrationBootstrap: payload.orchestrationBootstrap } : {}),
    ...(payload.suggestedSlotReasons.length ? { suggestedSlotReasons: [...payload.suggestedSlotReasons] } : {}),
    model,
    promptText: promptTextOut,
    provider: "openai",
    calledAt,
    questionQualityStatus,
    questionQualityIssues,
    questionQualityRetryCount,
    finalQuestionSource,
    ...(sugPack.issues.length ? { suggestionQualityIssues: sugPack.issues } : {}),
  };
}

export type InterviewBootstrapSuggestionsOnlyResult =
  | { ok: true; suggestions: string[]; model: string; promptText: string; provider: string; calledAt: string }
  | { ok: false; code: string; message: string };

/**
 * 부트스트랩 질문이 이미 정해졌을 때(HTTP 실패 등), 같은 맥락에서 선택지만 LLM으로 보강한다.
 * 실패 시 suggestions는 빈 배열.
 */
export async function runInterviewBootstrapSuggestionsOnlyOpenAI(input: {
  projectName: string;
  projectDescription: string;
  projectType?: string | null;
  interviewQuestion: string;
  orchestrationDigest?: string;
}): Promise<InterviewBootstrapSuggestionsOnlyResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = resolveOpenAiModelFromEnv();
  const pn = input.projectName.trim() || "(이름 없음)";
  const pd = input.projectDescription.trim() || "(설명 없음)";
  const pt = String(input.projectType ?? "").trim() || "(유형 미지정)";
  const q = String(input.interviewQuestion ?? "").trim().slice(0, 800);
  const digest = (input.orchestrationDigest ?? "").trim();
  const digestBlock = digest ? `\n[오케스트레이션 슬롯 스냅샷(요약)]\n${digest.slice(0, 4000)}` : "";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}당신은 서비스 기획 인터뷰용 "유도형 선택지 생성기"입니다.
사용자에게 직접 말하지 않습니다. 오직 JSON 한 개만 출력합니다.

프로젝트:
- 이름: ${pn}
- 설명: ${pd}
- 유형: ${pt}${digestBlock}

아래 질문에 답할 때 사용자가 참고할 수 있는 짧은 선택지 3~6개를 제안하세요.

규칙:
- 선택지는 위 프로젝트 정보·슬롯 스냅샷·질문 문장에만 근거합니다.
- 프로젝트와 무관한 업종/역할을 임의로 넣지 마세요.
- suggestions만 출력합니다.
- 선택지는 강제가 아님 — 사용자는 항상 다른 답을 쓸 수 있습니다.

[지금 묻는 질문]
${q || "(질문 없음)"}

[출력 — JSON 한 개만, 마크다운·코드펜스 금지]
{ "suggestions": ["선택지1", "선택지2"] }`;

  const user = "위 JSON만 출력하라.";
  const calledAt = new Date().toISOString();
  const promptText = `[system]\n${system}\n\n---\n\n[user]\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    maxTokens: 200,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}` };
  }
  const text = res.text;
  if (!text) {
    return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
  }

  let suggestions: string[] = [];
  try {
    const raw = stripJsonMarkdownFences(String(text).trim());
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(j.suggestions)) {
      suggestions = j.suggestions
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .slice(0, 6);
    }
  } catch {
    return { ok: false, code: "PARSE", message: "JSON 파싱 실패" };
  }

  return {
    ok: true,
    suggestions: normalizeLlmInterviewSuggestions(suggestions),
    model,
    promptText,
    provider: "openai",
    calledAt,
  };
}

export type IdeationInterviewSeedWire = Readonly<{
  /** slotId -> "empty" | "partial" | "filled" */
  serviceIdea?: string;
  targetUser?: string;
  coreProblem?: string;
  expectedOutcome?: string;
  roughActors?: string;
  roughFlow?: string;
  mustHaveFeatures?: string;
  constraints?: string;
  notes?: Partial<Record<string, string[]>>;
  summary?: string;
  nextBestSlot?: string | null;
  confidence?: number;
}>;

/**
 * 아이디어 구체화: 프로젝트명/설명만으로 8개 슬롯의 초기 상태(채움 정도 + 근거 notes)를 시드한다.
 * - 대화가 비어 있을 때 UI가 0/8로 시작하지 않게 하며, 첫 질문을 더 정교하게 유도할 수 있다.
 */
export async function runRequirementsIdeationInterviewSeedFromProjectOpenAI(input: {
  projectName: string;
  projectDescription: string;
  projectType?: string | null;
}): Promise<{ ok: true; wire: IdeationInterviewSeedWire; model: string } | { ok: false; code: string; message: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = resolveOpenAiModelFromEnv();
  const pn = input.projectName.trim() || "(이름 없음)";
  const pd = input.projectDescription.trim() || "(설명 없음)";
  const pt = String(input.projectType ?? "").trim() || "—";

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      {
        role: "system",
        content: `${workspaceAiMemberSystemPrefix("ideation")}당신은 아이디어 구체화 단계의 '상태 시드 생성기'입니다. 출력은 반드시 JSON 오브젝트 1개만. 마크다운 금지.`,
      },
      {
        role: "user",
        content: `프로젝트명/설명/유형만 보고, 아래 8개 슬롯의 초기 채움 정도를 추정해라.

[프로젝트]
- 이름: ${pn}
- 설명: ${pd}
- 유형: ${pt}

[슬롯]
- serviceIdea: 무엇을 만들고 싶은가(서비스 아이디어 한 문장)
- targetUser: 주 사용자(역할)
- coreProblem: 현재 가장 큰 불편/문제(1개)
- expectedOutcome: 어떻게 개선되길 원하는가(기대 효과/목표 상태)
- roughActors: 사용자 종류(개략)
- roughFlow: 서비스 흐름(한 줄)
- mustHaveFeatures: 반드시 필요한 핵심 기능 3개 내외
- constraints: 예산/기간/정책/보안 등 큰 제약

[출력 JSON 스키마 - 키/형식 엄수]
{
  "summary": "프로젝트를 1~2문장으로 해석한 요약",
  "serviceIdea": "empty|partial|filled",
  "targetUser": "empty|partial|filled",
  "coreProblem": "empty|partial|filled",
  "expectedOutcome": "empty|partial|filled",
  "roughActors": "empty|partial|filled",
  "roughFlow": "empty|partial|filled",
  "mustHaveFeatures": "empty|partial|filled",
  "constraints": "empty|partial|filled",
  "notes": {
    "serviceIdea": [], "targetUser": [], "coreProblem": [], "expectedOutcome": [],
    "roughActors": [], "roughFlow": [], "mustHaveFeatures": [], "constraints": []
  },
  "nextBestSlot": "serviceIdea|targetUser|coreProblem|expectedOutcome|roughActors|roughFlow|mustHaveFeatures|constraints|null",
  "confidence": 0.0
}

[규칙]
- notes는 '프로젝트 설명에서 유추 가능한 근거'를 짧은 불릿(문장)으로 0~2개만 넣어라.
- 근거가 약하면 해당 슬롯은 empty 또는 partial로 둔다.
- 절대 상세 설계/화면/DB/API로 들어가지 말 것.
- 한국어로 작성.`,
      },
    ],
    temperature: 0.2,
    responseFormatJsonObject: true,
    maxTokens: 520,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}` };
  }
  const text = res.text;
  if (!text) return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };

  try {
    const wire = JSON.parse(text) as IdeationInterviewSeedWire;
    if (!wire || typeof wire !== "object") throw new Error("invalid-json");
    return { ok: true, wire, model };
  } catch (e) {
    return { ok: false, code: "BAD_JSON", message: "시드 JSON 파싱에 실패했습니다." };
  }
}

function safeJsonArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export async function runRequirementsDraftOpenAI(input: {
  projectName: string;
  projectDescription: string;
  stage: "requirements";
  /** 구버전 호환: 구조화 입력이 없을 때만 주력으로 사용 */
  dialogueExcerpt?: string;
  userMessage: string;
  existingDraft?: unknown;
  responseStyle?: RequirementsAiResponseStyle;
  memoryFacts?: OrganizeMemoryFacts | null;
  rollingSummary?: string;
  recentMessages?: string;
  /** true면 dialogueExcerpt를 전체 원문 폴백으로 추가 제공 */
  useRawDialogueFallback?: boolean;
}): Promise<RequirementsDraftOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = resolveOpenAiModelFromEnv();
  const excerpt = String(input.dialogueExcerpt ?? "").trim().slice(0, 24_000);
  const existingDraftText = input.existingDraft ? JSON.stringify(input.existingDraft).slice(0, 12_000) : "";

  const memoryFactsText = formatMemoryFactsForModel(input.memoryFacts ?? undefined).trim();
  const mandatoryReminder = formatMandatoryReminderForModel(input.memoryFacts ?? undefined).trim();
  const rolling = String(input.rollingSummary ?? "").trim();
  const useRaw = Boolean(input.useRawDialogueFallback);
  const recentTrim = String(input.recentMessages ?? "").trim();
  const recentForModel = recentTrim
    ? recentTrim.slice(0, 24_000)
    : !useRaw && excerpt
      ? excerpt.slice(0, 24_000)
      : "";
  const hasStructured = Boolean(memoryFactsText || rolling || recentForModel);

  const contextBlock = hasStructured
    ? [
        memoryFactsText && `[memory_facts]\n${memoryFactsText}`,
        rolling && `[rolling_summary]\n${rolling}`,
        recentForModel && `[recent_messages]\n${recentForModel}`,
        mandatoryReminder && `${mandatoryReminder}`,
        useRaw && excerpt && `[전체 대화 원문(폴백)]\n${excerpt}`,
        !useRaw && `[전체 대화 원문]\n전체 원문은 제공하지 않는다. 위 memory_facts·rolling_summary·recent_messages만 근거로 삼아라. 빈약하면 openIssues에 '확인 필요'로 남겨라.`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : `[memory_facts]\n(없음)\n\n[rolling_summary]\n(없음)\n\n[recent_messages]\n(없음)\n\n프로젝트 이름·설명·사용자 요청만으로 초안을 구성하고, 불확실한 항목은 openIssues에 '확인 필요'로 남겨라.`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      {
        role: "system",
        content: `${workspaceAiMemberSystemPrefix("ideation")}You are a senior product manager. Output only a valid JSON object. No markdown fences. Keep strings concise and actionable.`,
      },
      {
        role: "user",
        content: `다음 프로젝트 요구사항 협의 대화를 바탕으로 구조화된 요구사항 초안 JSON을 생성해라.

[프로젝트]
- 이름: ${input.projectName.trim() || "(이름 없음)"}
- 설명: ${input.projectDescription.trim() || "(설명 없음)"}

[현재 단계]
- Requirements(요구사항)

${contextBlock}

[기존 정리본(있다면)]
${existingDraftText || "(없음)"}

[사용자 최신 요청]
${input.userMessage.trim()}

[출력 JSON 스키마 - 키를 정확히 맞춰라]
{
  "overview": "프로젝트 개요(1~3문장)",
  "goals": ["목표1", ...],
  "users": ["대상 사용자/역할1", ...],
  "features": ["핵심 기능1", ...],
  "excluded": ["제외 범위1", ...],
  "nonFunctional": ["비기능 요구사항1", ...],
  "successCriteria": ["성공 기준1", ...],
  "openIssues": ["미결정 이슈1", ...]
}

[규칙]
- overview/users/features/successCriteria는 비어있지 않게(최소 1개 이상) 추론해 채워라.
- 근거가 약하면 openIssues에 '확인 필요'로 남겨라.
- 한국어로 작성.${draftResponseStyleAddendum(input.responseStyle)}`,
      },
    ],
    temperature: 0.25,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}`,
    };
  }

  const text = res.text;
  if (!text) {
    return { ok: false, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, code: "JSON_PARSE", message: "OpenAI JSON 파싱에 실패했습니다." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, code: "SCHEMA", message: "OpenAI 응답 스키마가 올바르지 않습니다." };
  }
  const o = parsed as Record<string, unknown>;
  const draft = {
    overview: String(o.overview ?? "").trim(),
    goals: safeJsonArray(o.goals),
    users: safeJsonArray(o.users),
    features: safeJsonArray(o.features),
    excluded: safeJsonArray(o.excluded),
    nonFunctional: safeJsonArray(o.nonFunctional),
    successCriteria: safeJsonArray(o.successCriteria),
    openIssues: safeJsonArray(o.openIssues),
  };
  if (!draft.overview || draft.users.length === 0 || draft.features.length === 0 || draft.successCriteria.length === 0) {
    return { ok: false, code: "SCHEMA", message: "초안 필수 항목이 비어 있습니다." };
  }
  return { ok: true, draft, model };
}

export type IdeationDeliverablesOpenAiResult =
  | { ok: true; outputs: Partial<Record<IdeationDeliverableType, string>>; model: string }
  | { ok: false; code: string; message: string };

/**
 * 아이디어 협의실: 선택한 산출물 유형별 본문을 한 번에 생성(JSON).
 */
export async function runIdeationDeliverablesOpenAI(input: {
  projectName: string;
  projectDescription: string;
  chatSummary: string;
  dialogueExcerpt: string;
  revisionRequest?: string;
  selectedTypes: readonly IdeationDeliverableType[];
  responseStyle?: RequirementsAiResponseStyle;
}): Promise<IdeationDeliverablesOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const types = input.selectedTypes.filter(Boolean);
  if (!types.length) {
    return { ok: false, code: "NO_TYPES", message: "선택된 산출물이 없습니다." };
  }

  const model = resolveOpenAiModelFromEnv();
  const excerpt = input.dialogueExcerpt.trim().slice(0, 24_000);
  const base = buildIdeationDeliverableBasePrompt({
    projectName: input.projectName.trim() || "(이름 없음)",
    projectDescription: input.projectDescription.trim() || "(설명 없음)",
    chatSummary: input.chatSummary.trim() || "(저장된 요약 없음)",
    recentMessages: excerpt || "(최근 대화 없음)",
  });
  const userBlock = buildIdeationDeliverablesUserPrompt(types);
  const keysLine = types.map((t) => `"${t}"`).join(", ");
  const revisionBlock = input.revisionRequest?.trim()
    ? `\n\n[수정 요청 — 반드시 반영]\n아래 수정 요청을 최우선으로 반영하여 산출물 본문을 **개정**하세요.\n- 가능하면 기존 구조/섹션을 유지하되, 요청 사항을 반영해 내용과 표현을 개선합니다.\n- 요청과 충돌하는 기존 내용이 있다면 요청을 우선합니다.\n\n수정 요청:\n${input.revisionRequest.trim()}`
    : "";

  const callModel = async (userContent: string) => {
    const res = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        {
          role: "system",
          content: `${workspaceAiMemberSystemPrefix("ideation")}You are a Korean product planning assistant. Output only one valid JSON object. No markdown fences.${facilitatorResponseStyleAddendum(input.responseStyle)}`,
        },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      responseFormatJsonObject: true,
    });

    if (!res.ok) {
      return {
        ok: false as const,
        code: res.code,
        message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}`,
      };
    }

    const text = res.text;
    if (!text) {
      return { ok: false as const, code: "EMPTY", message: "OpenAI 응답 본문이 비어 있습니다." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonMarkdownFences(text)) as unknown;
    } catch {
      return { ok: false as const, code: "JSON_PARSE", message: "OpenAI JSON 파싱에 실패했습니다." };
    }

    const extracted = extractIdeationDeliverableOutputsFromRoot(parsed, types);
    if (!extracted.ok) {
      return { ok: false as const, code: "SCHEMA", message: extracted.message };
    }
    return { ok: true as const, outputs: extracted.outputs };
  };

  const first = await callModel(`${base}${revisionBlock}\n\n${userBlock}`);
  if (first.ok) {
    return { ok: true, outputs: first.outputs, model };
  }

  const retryable = first.code === "SCHEMA" || first.code === "JSON_PARSE";
  if (!retryable) {
    return first;
  }

  const repair = `\n\n[재시도 — 필수]\n직전 응답이 규격에 맞지 않았습니다. 다시 **유효한 JSON 한 개만** 출력하세요.\n최상위에 "outputs" 객체를 두고, 키 ${keysLine} 각각에 **비어 있지 않은 마크다운 문자열**을 넣으세요.\n각 문자열은 최소 400자 이상의 실질 본문이어야 합니다. 공백만 있는 값 금지.`;
  const second = await callModel(`${base}${revisionBlock}\n\n${userBlock}${repair}`);
  if (second.ok) {
    return { ok: true, outputs: second.outputs, model };
  }
  return second;
}

export type OpenAiModelsPingResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export type InterviewAnalyzeOpenAiResult =
  | { ok: true; payload: InterviewAnalyzerPayload; model: string }
  | { ok: false; code: string; message: string };

export type ServiceFlowAnalyzeIntent =
  | "add_actor"
  | "update_actor"
  | "add_step"
  | "update_step"
  | "update_mapping"
  | "show_summary"
  | "delegate_to_ai"
  | "unclear";

export type ServiceFlowAnalyzeOpenAiResult =
  | {
      ok: true;
      data: {
        assistantMessage: string;
        updatedFlow: RequirementsServiceFlowV1;
        intent: ServiceFlowAnalyzeIntent;
        nextQuestion: string | null;
        quickReplies: string[] | null;
        readiness: {
          score: number;
          actorsReady: boolean;
          stepsReady: boolean;
          mappingReady: boolean;
          readyForNext: boolean;
        };
      };
      model: string;
    }
  | { ok: false; code: string; message: string };

function interviewStateJsonForAnalyzer(state: ProblemInterviewState): string {
  return JSON.stringify(problemInterviewStateToAnalyzerWire(state));
}

function clamp01Score(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function safeText(v: unknown, max = 520): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function ensureServiceFlowShape(v: unknown, nowIso: string): RequirementsServiceFlowV1 | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const actorsRaw = Array.isArray(o.actors) ? o.actors : [];
  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];

  const actors = actorsRaw
    .map((a) => {
      const aa = a as Record<string, unknown>;
      const id = safeText(aa.id, 90);
      const name = safeText(aa.name, 60);
      const kind = safeText(aa.kind, 16) === "system" ? "system" : "human";
      const description = safeText(aa.description, 140);
      if (!id || !name) return null;
      return { id, name, kind, description };
    })
    .filter(Boolean) as RequirementsServiceFlowV1["actors"];

  const actorIds = new Set(actors.map((a) => a.id));
  const steps = stepsRaw
    .map((s) => {
      const ss = s as Record<string, unknown>;
      const id = safeText(ss.id, 140);
      const title = safeText(ss.title, 80);
      const purpose = safeText(ss.purpose, 240);
      const order = Number(ss.order);
      const primaryActorId = safeText(ss.primaryActorId, 90);
      const secondaryActorIds = Array.isArray(ss.secondaryActorIds)
        ? (ss.secondaryActorIds.map((x) => safeText(x, 90)).filter(Boolean) as string[])
        : [];
      const approved = Boolean(ss.approved);
      const updatedAt = safeText(ss.updatedAt, 40) || nowIso;
      if (!id || !title || !Number.isFinite(order)) return null;
      return {
        id,
        title,
        purpose,
        order: Math.max(1, Math.round(order)),
        primaryActorId: primaryActorId && actorIds.has(primaryActorId) ? primaryActorId : "",
        secondaryActorIds: secondaryActorIds.filter((x) => actorIds.has(x)),
        approved,
        updatedAt,
      };
    })
    .filter(Boolean) as RequirementsServiceFlowV1["steps"];

  return {
    createdAt: safeText(o.createdAt, 40) || nowIso,
    updatedAt: safeText(o.updatedAt, 40) || nowIso,
    actors,
    steps,
  };
}

export async function runServiceFlowAnalyzeOpenAI(input: {
  projectName: string;
  projectDescription: string;
  ideationAssets?: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  userMessage: string;
  currentFlow: RequirementsServiceFlowV1 | null;
  recentMessages: string;
  latestAiQuestion: string;
  priorScreenHandoff?: string;
  participatingAgentsPromptBlock?: string;
}): Promise<ServiceFlowAnalyzeOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = resolveOpenAiModelFromEnv();
  const nowIso = new Date().toISOString();
  const flowJson = JSON.stringify(input.currentFlow ?? { createdAt: nowIso, updatedAt: nowIso, actors: [], steps: [] }).slice(0, 22_000);
  const recent = safeText(input.recentMessages, 18_000);
  const assetsBlock = (input.ideationAssets ?? [])
    .map((a) => {
      const type = String(a?.type ?? "").trim();
      const title = String(a?.title ?? "").trim();
      const content = String(a?.content ?? "").trim();
      if (!content) return "";
      return `- ${type || "산출물"}${title ? `: ${title}` : ""}\n${content.slice(0, 2500)}`;
    })
    .filter(Boolean)
    .join("\n\n");
  const serviceFlowHandoffBlock = (input.priorScreenHandoff ?? "").trim()
    ? `\n\n[이전 화면에서 넘어온 맥락]\n${(input.priorScreenHandoff ?? "").trim().slice(0, 4000)}`
    : "";

  const sfAgentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n\n${(input.participatingAgentsPromptBlock ?? "").trim()}\n`
    : "";

  const system = `${workspaceAiMemberSystemPrefix("actor_flow")}${sfAgentInsert}이 단계의 실제 목적은 "아이디어 구체화 결과 기반의 서비스 흐름 검증/보정/담당 확정"이다.
중요: 이 단계에서 "이제 흐름을 정의해볼까요?"처럼 백지 디스커버리를 다시 시작하면 실패다.

목표:
사용자의 자연어 발화를 의미 기반으로 해석하여, 액터/서비스 단계/담당 매핑 상태(updatedFlow)를 업데이트하고,
사용자가 이해하기 쉬운 짧은 응답(assistantMessage)과 다음 질문(nextQuestion)을 만든다.
항상 아래 6가지 중 하나를 앞으로 진전시키는 질문만 한다:
1) 액터 검증
2) 흐름 단계 검증/보정
3) 각 단계 담당자(primaryActorId) 지정
4) 승인/확정 단계 확인(없으면 추가 제안)
5) 예외 처리/반려/재처리 흐름 확인
6) 기능정리 단계로 이동할 준비 확인

중요 규칙:
- ideationAssets가 존재하면, 그 내용을 이 단계의 source of truth로 우선 사용한다(현재 flow가 비어 있어도 초안을 추론/생성하라).
- 사용자가 이미 말한 내용을 다시 질문하지 않는다(재진술 후 검증 질문 1개로 좁혀라).
- 최초 응답은 "질문"보다 "초안 제시"가 우선이다(assistantMessage에 먼저 초안/요약을 제시하고, nextQuestion으로 검증 질문 1개).
- "없습니다/모르겠습니다" 같은 무지성 응답 금지. 정보가 부족하면 합리적 기본안을 제안하고 검증 질문으로 확인한다.
- 이 단계는 discovery가 아니라 refinement/confirmation 단계다.
- 키워드 매칭/룰 기반으로 판단하지 말고 의미로 판단한다.
- assistantMessage는 반드시 updatedFlow와 일치해야 한다(말만 하고 상태가 안 바뀌면 실패).
- 사용자가 "액터목록을 보여줘/액터 목록 보여줘" 등 요약 요청이면 intent=show_summary로 두고,
  assistantMessage에 현재 updatedFlow의 액터 목록을 그대로 출력한다.
- nextQuestion은 필요한 경우에만(모호하거나 빠진 정보가 있을 때) 1문장 질문으로 넣고, 없으면 null.
- nextQuestion이 있을 때는, 가능하면 quickReplies(최대 3개)를 같이 제안한다. (예: ["시스템 자동 생성", "작성자가 직접", "둘 다"])
- quickReplies는 사용자가 클릭해 답할 수 있는 짧은 선택지 문자열만. 없으면 null.
- 이 단계는 "검증/확정 인터뷰형" UX다. 사용자가 백지로 길게 쓰지 않아도 되도록 질문을 단계적으로 진행한다.
- 질문은 한 번에 하나만. (설문처럼 여러 문항을 나열하지 말 것)
- 이 단계에서 "기능 세부 명세/기능 옵션 상세/UI 상세 정의"를 질문하거나 확정하려고 하지 말 것.
  - 사용자가 그 내용을 요청하면 assistantMessage에 반드시 아래 문장을 포함해 부드럽게 다음 단계로 안내한다:
    "세부 기능 정의는 다음 기능정리 단계에서 진행됩니다."
  - 그리고 nextQuestion은 위 1)~5) 중 미확정인 항목만 1개로 좁혀서 묻는다.
- 질문은 가능한 한 "현재 상태 JSON"과 "아이디어 구체화 산출물"에서 이미 존재하는 내용을 인용/요약한 뒤,
  누락/수정/확정이 필요한 1가지만 확인하는 방식으로 만든다.
- 최신 발화가 모호해도 "처음부터 다시 설명"을 요구하지 말고, 선택지(quickReplies) 또는 1문장 уточถาม으로 좁혀라.
- latestAiQuestion과 updatedFlow/readiness를 참고해 "다음 질문"을 결정한다.
- userMessage가 "인터뷰 시작"으로 시작하면, 반드시 "상속된 맥락 검증 모드"로 시작한다.
  - 현재 updatedFlow.steps가 1개 이상이면: 그 흐름을 3~8개 항목으로 짧게 재진술하고(assistantMessage),
    "누락/수정할 단계가 있습니까?" 같은 검증 질문 1개를 nextQuestion으로 둔다.
    quickReplies 예: ["단계 수정 있어요", "빠진 단계 있어요", "그대로 진행"].
  - steps가 없고 actors만 있으면: "첫 단계는 무엇입니까?"처럼 흐름 검증 시작 질문 1개를 nextQuestion으로 둔다.
  - actors도 없으면: 아이디어 구체화 산출물에서 액터/흐름을 최소 초안으로 채우고, 즉시 검증 질문 1개를 nextQuestion으로 둔다.
- 인터뷰가 충분히 채워졌고(readyForNext=true가 될 수 있을 정도) nextQuestion이 null이면, assistantMessage는 짧게 마무리한다.
- 응답은 반드시 JSON 1개만 출력(마크다운/설명/코드펜스 금지).

의도(intent) 분류:
add_actor|update_actor|add_step|update_step|update_mapping|show_summary|delegate_to_ai|unclear

Readiness:
- actorsReady: actors.length >= 2
- stepsReady: steps.length >= 3
- mappingReady: 모든 step.primaryActorId가 존재하고 actors에 포함
- readyForNext: 위 3개 모두 true
- score: 0~100`;

  const user = `[프로젝트]
이름: ${input.projectName.trim() || "(이름 없음)"}
설명: ${input.projectDescription.trim() || "(설명 없음)"}${serviceFlowHandoffBlock}

[직전 AI 질문(맥락)]
${input.latestAiQuestion.trim() || "(없음)"}

[최근 대화(발췌)]
${recent || "(없음)"}

[아이디어 구체화 산출물]
${assetsBlock || "(없음)"}

[현재 서비스흐름 상태 JSON]
${flowJson}

[사용자 최신 발화]
${input.userMessage.trim()}

[출력 스키마]
{
  "assistantMessage": "사용자에게 보여줄 메시지(짧게)",
  "updatedFlow": { "createdAt": "...", "updatedAt": "...", "actors": [], "steps": [] },
  "intent": "add_actor|update_actor|add_step|update_step|update_mapping|show_summary|delegate_to_ai|unclear",
  "nextQuestion": "질문 한 문장?" | null,
  "quickReplies": ["선택지1", "선택지2", "선택지3"] | null,
  "readiness": { "score": 0, "actorsReady": true, "stepsReady": true, "mappingReady": true, "readyForNext": true }
}`;

  const callOnce = async (repair: boolean) => {
    const res = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: repair
            ? `${user}\n\n[재시도] 직전 출력이 스키마에 맞지 않았습니다. 위 스키마의 JSON만 다시 출력하세요.`
            : user,
        },
      ],
      temperature: 0.18,
      responseFormatJsonObject: true,
    });
    if (!res.ok) {
      return { ok: false as const, code: res.code, message: res.message.slice(0, 400) };
    }
    const text = res.text;
    if (!text) return { ok: false as const, code: "EMPTY", message: "응답 본문이 비어 있습니다." };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { ok: false as const, code: "PARSE", message: "JSON 파싱 실패" };
    }
    return { ok: true as const, parsed };
  };

  let r = await callOnce(false);
  if (!r.ok && (r.code === "PARSE" || r.code === "EMPTY")) r = await callOnce(true);
  if (!r.ok) return r;

  const root = r.parsed as Record<string, unknown>;
  const updatedFlow = ensureServiceFlowShape(root.updatedFlow, nowIso);
  if (!updatedFlow) return { ok: false, code: "SCHEMA", message: "updatedFlow 스키마가 올바르지 않습니다." };

  const intentRaw = safeText(root.intent, 40) as ServiceFlowAnalyzeIntent;
  const allowed: ServiceFlowAnalyzeIntent[] = [
    "add_actor",
    "update_actor",
    "add_step",
    "update_step",
    "update_mapping",
    "show_summary",
    "delegate_to_ai",
    "unclear",
  ];
  const intent: ServiceFlowAnalyzeIntent = allowed.includes(intentRaw) ? intentRaw : "unclear";

  const readinessRaw = (root.readiness ?? {}) as Record<string, unknown>;
  const readiness = {
    score: clamp01Score(readinessRaw.score),
    actorsReady: Boolean(readinessRaw.actorsReady),
    stepsReady: Boolean(readinessRaw.stepsReady),
    mappingReady: Boolean(readinessRaw.mappingReady),
    readyForNext: Boolean(readinessRaw.readyForNext),
  };

  const quickReplies = Array.isArray(root.quickReplies)
    ? (root.quickReplies.map((x) => safeText(x, 40)).filter(Boolean).slice(0, 3) as string[])
    : null;

  return {
    ok: true,
    model,
    data: {
      assistantMessage: safeText(root.assistantMessage, 900) || "반영했습니다.",
      updatedFlow,
      intent,
      nextQuestion: safeText(root.nextQuestion, 240) || null,
      quickReplies: quickReplies && quickReplies.length ? quickReplies : null,
      readiness,
    },
  };
}

/**
 * 기획안 인터뷰: 사용자 한 턴을 슬롯 상태로만 해석(JSON). 채팅 응답을 생성하지 않는다.
 */
export async function runInterviewAnalyzeOpenAI(input: {
  projectName: string;
  projectDescription: string;
  projectType?: string | null;
  userMessage: string;
  latestAiQuestion: string;
  currentInterviewState: ProblemInterviewState;
  participatingAgentsPromptBlock?: string;
  /** SingleChat 슬롯 요약(텍스트) */
  orchestrationDigest?: string;
  /** 직전 턴에서 사용자가 탭한 추천 칩 문구(선택) */
  selectedSuggestion?: string | null;
  /** 사용자가 UI에서 답글로 지정한 부모 메시지(맥락) */
  replyToMessageId?: string | null;
  replyToSlotKey?: string | null;
  replyTargetSpeakerId?: string | null;
  /** 직전 질문의 슬롯 키(클라이언트 추정) */
  currentSlotKey?: string | null;
}): Promise<InterviewAnalyzeOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = resolveOpenAiModelFromEnv();
  const stateJson = interviewStateJsonForAnalyzer(input.currentInterviewState);

  const iaAgentInsert = (input.participatingAgentsPromptBlock ?? "").trim()
    ? `\n\n${(input.participatingAgentsPromptBlock ?? "").trim()}\n`
    : "";

  const system = `${workspaceAiMemberSystemPrefix("ideation")}${iaAgentInsert}당신은 아이디어 구체화 단계(고수준 디스커버리) 전용 "상태 분석기"입니다. 사용자와 대화하지 않습니다.
역할:
1) 사용자의 최신 답변을 읽고, 아래 8개 슬롯에 정보가 얼마나 담겼는지 분류합니다.
2) 사용자의 답변 intent를 분류합니다(질문에 직접 답하지 않아도 "AI에게 판단을 위임"이면 delegate_to_ai).

슬롯 정의(아이디어 구체화용 8개 — 다음 단계로 넘길 고수준 정보만):
- serviceIdea: 무엇을 만들고 싶은가(서비스 아이디어 한 문장)
- targetUser: 주 사용자(역할)
- coreProblem: 현재 가장 큰 불편/문제(1개)
- expectedOutcome: 어떻게 개선되길 원하는가(기대 효과/목표 상태)
- roughActors: 사용자 종류(개략: 예. 일반 사용자/관리자)
- roughFlow: 서비스 흐름(한 줄: 예. 업로드 → 분석 → 결과 확인)
- mustHaveFeatures: 반드시 필요한 핵심 기능 3개 내외
- constraints: 예산/기간/정책/보안 등 큰 제약

핵심 원칙:
- 상세 액터 시나리오/권한 매트릭스 금지
- 상세 화면 플로우 금지
- 세부 CRUD/DB 구조/API 상세 금지
- 위 상세 내용은 다음 탭(액터/흐름 정의, 기능 정리, 작업 정리 등)에서 다룬다.

규칙:
- 의미 기반으로 판단한다(키워드만 맞추지 않는다).
- 문제정의·현재 방식만 채워졌다고 끝내지 말고, 나머지 슬롯도 채울 때까지 partial/empty를 남긴다.
- "filled"는 사용자가 그 슬롯을 문맥상 명확히 답했을 때만 부여한다. 한마디·암시만 있으면 partial 또는 empty로 둔다.
- intent 판단:
  - answer: 사용자가 실제 정보를 제공함(질문과 불일치해도 정보가 있으면 answer)
  - delegate_to_ai: 사용자가 판단/선택/기준 설정을 AI에게 위임함(예: 알아서/추천/네가 정해/좋은 방식으로)
  - skip: 해당 질문을 건너뜀/모르겠음/응답 거부
  - unclear: 의미가 불명확
  - 위 예시에만 의존하지 말고 의미로 판단하라.
- delegate_to_ai인 경우:
  - delegatedSlot을 지정한다: (직전 질문 슬롯이 적절하면 그것을, 아니면 가장 근접한 슬롯)
  - delegatedDefault에 AI가 적용할 기본안 한 줄을 쓴다(예: “기본 추천안 적용”, “업계 일반 기준으로 설정”)
- globalDelegation 판단:
  - 사용자가 "이후 질문은 AI가 알아서/추가 질문 없이 진행/남은 건 AI가 판단"처럼 **남은 모든 결정을 위임**하면 globalDelegation=true.
  - globalDelegation=true일 때는 delegatedSlot이 null이어도 된다.
- 출력은 JSON 한 개만이다. 마크다운·코드펜스·JSON 밖의 설명 금지.
- slots의 각 값은 반드시 "empty" | "partial" | "filled" 중 하나(구 키 filledSlots는 쓰지 말 것).
- 8개 슬롯이 모두 "filled"이면 nextBestSlot은 반드시 null.
- nextBestSlot은 아직 filled가 아니면서 이번 답으로 가장 보강해야 할 슬롯 하나(없으면 null).
- confidence는 0~1 실수(모델 확신도).
- notes에는 해당 슬롯에서 뽑은 짧은 근거 불릿(한국어) 문자열만 배열로 넣는다.
- nextInterviewQuestion / nextInterviewSuggestions 는 **다음 사용자 턴에 보여줄** 질문·유도형 선택지다(선택지는 강제가 아님).
- nextInterviewSuggestions: 3~6개, 프로젝트명·설명·유형·슬롯 스냅샷과 직접 연관된 짧은 문구만. 무관 업종/역할 금지.
- allowCustomInput 은 기본 true.

추가 정책(다음 질문 생성):
- currentSlotKey가 주어지면, 사용자의 답변이 해당 슬롯을 얼마나 채웠는지 먼저 판단한다.
- slotAdvanceDecision:
  - stay_current_slot: 답변이 불충분/모호/짧음/신뢰도 낮음이면 같은 슬롯 후속 질문을 한다.
  - advance_next_slot: 현재 슬롯이 충분히 partial 이상으로 확보되었다고 판단되면 다음 슬롯으로 이동한다.
- shouldAskFollowUp / followUpReason를 함께 출력해라.
- nextQuestionSlotKey는 다음 질문이 겨냥하는 슬롯 키이다(현재 유지면 currentSlotKey, 이동이면 nextBestSlot 또는 우선순위).

JSON 스키마(키 이름·형식 엄수):
{
  "intent": "answer|delegate_to_ai|skip|unclear",
  "delegatedSlot": "serviceIdea|targetUser|coreProblem|expectedOutcome|roughActors|roughFlow|mustHaveFeatures|constraints|null",
  "delegatedDefault": "AI가 적용할 기본안 설명(짧게)",
  "globalDelegation": true|false,
  "summary": "한두 문장 한국어 요약",
  "slots": {
    "serviceIdea": "empty|partial|filled",
    "targetUser": "empty|partial|filled",
    "coreProblem": "empty|partial|filled",
    "expectedOutcome": "empty|partial|filled",
    "roughActors": "empty|partial|filled",
    "roughFlow": "empty|partial|filled",
    "mustHaveFeatures": "empty|partial|filled",
    "constraints": "empty|partial|filled"
  },
  "notes": {
    "serviceIdea": [], "targetUser": [], "coreProblem": [], "expectedOutcome": [],
    "roughActors": [], "roughFlow": [], "mustHaveFeatures": [], "constraints": []
  },
  "nextBestSlot": "serviceIdea" | "targetUser" | "coreProblem" | "expectedOutcome" | "roughActors" | "roughFlow" | "mustHaveFeatures" | "constraints" | null,
  "confidence": 0.0,
  "currentSlotKey": "serviceIdea" | "targetUser" | "coreProblem" | "expectedOutcome" | "roughActors" | "roughFlow" | "mustHaveFeatures" | "constraints" | null,
  "slotAdvanceDecision": "stay_current_slot" | "advance_next_slot",
  "shouldAskFollowUp": true|false,
  "followUpReason": "한 줄 이유(짧게)",
  "nextQuestionSlotKey": "serviceIdea" | "targetUser" | "coreProblem" | "expectedOutcome" | "roughActors" | "roughFlow" | "mustHaveFeatures" | "constraints" | null,
  "nextInterviewQuestion": "한국어 질문 한 문장(? 하나만)",
  "nextInterviewSuggestions": ["선택지1", "선택지2"],
  "allowCustomInput": true
}`;

  const sugLine = (input.selectedSuggestion ?? "").trim()
    ? `\n[사용자가 참고한 추천 선택지]\n${(input.selectedSuggestion ?? "").trim()}`
    : "";
  const digest = (input.orchestrationDigest ?? "").trim();
  const digestBlock = digest ? `\n[오케스트레이션 슬롯 스냅샷(요약)]\n${digest.slice(0, 6000)}` : "";
  const pt = String(input.projectType ?? "").trim() || "—";
  const rid = (input.replyToMessageId ?? "").trim();
  const rSlot = (input.replyToSlotKey ?? "").trim();
  const rSpk = (input.replyTargetSpeakerId ?? "").trim();
  const curSlot = String(input.currentSlotKey ?? "").trim();
  const replyCtx =
    rid || rSlot || rSpk
      ? `\n[사용자 답글 대상(지정됨)]
messageId: ${rid || "—"}
interviewSlot(추정): ${rSlot || "—"}
parentSpeakerId: ${rSpk || "—"}`
      : "";
  const curSlotBlock = curSlot ? `\n[현재 질문 슬롯(클라이언트 추정)]\n${curSlot}` : "";

  const userBlock = `[프로젝트]
이름: ${input.projectName.trim() || "(이름 없음)"}
설명: ${input.projectDescription.trim() || "(설명 없음)"}
유형: ${pt}${digestBlock}

[직전 AI 질문(맥락)]
${input.latestAiQuestion.trim() || "(없음)"}
${replyCtx}${curSlotBlock}

[현재 인터뷰 상태 JSON]
${stateJson}

[사용자 최신 답변]
${input.userMessage.trim()}${sugLine}`;

  const callOnce = async (repair: string) => {
    const res = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: repair ? `${userBlock}\n\n[재시도] 직전 출력이 스키마에 맞지 않았습니다. 위 스키마의 JSON만 다시 출력하세요.` : userBlock,
        },
      ],
      temperature: 0.12,
      responseFormatJsonObject: true,
    });
    if (!res.ok) {
      return { ok: false as const, code: res.code, message: res.message.slice(0, 400) };
    }
    const text = res.text;
    if (!text) return { ok: false as const, code: "EMPTY", message: "응답 본문이 비어 있습니다." };
    const payload = parseInterviewAnalyzerPayloadFromModelText(text);
    if (!payload) return { ok: false as const, code: "PARSE", message: "JSON 파싱 실패" };
    return { ok: true as const, payload, model };
  };

  let r = await callOnce("");
  if (!r.ok && r.code === "PARSE") {
    r = await callOnce("retry");
  }
  if (!r.ok) return r;
  const cur = String(input.currentSlotKey ?? "").trim();
  const patched: InterviewAnalyzerPayload =
    cur && isProblemInterviewSlot(cur) && !r.payload.currentSlotKey
      ? { ...r.payload, currentSlotKey: cur }
      : r.payload;
  return { ok: true, payload: patched, model: r.model };
}

/** API 키 유효성·네트워크를 가볍게 확인합니다. */
export async function pingOpenAiModelsList(apiKeyOverride?: string | null): Promise<OpenAiModelsPingResult> {
  const apiKey = String(apiKeyOverride ?? "").trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OpenAI API 키가 없습니다. Integrations 또는 OPENAI_API_KEY를 설정하세요." };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/models?limit=1", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, code: `HTTP_${res.status}`, message: t.slice(0, 300) || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "NETWORK", message: msg };
  }
}
