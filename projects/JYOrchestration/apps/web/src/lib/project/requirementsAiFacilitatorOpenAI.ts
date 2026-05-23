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
  detectInternalOrchestrationVocabInUserQuestion,
  filterBootstrapInterviewSuggestions,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import { runBootstrapProposalFallbackSynthesisOpenAI } from "@/lib/requirements/bootstrapProposalFallbackSynthesis";
import {
  buildBootstrapProposalRegenerationUserPayload,
  parseBootstrapProposalDraftFromJson,
  proposalDraftPreviewForDiagnostics,
  synthesizeBootstrapUserMessageFromProposalDraft,
  validateBootstrapProposalDraft,
  type BootstrapProposalDraftWire,
} from "@/lib/requirements/requirementsBootstrapProposalDraft";
import { formatBootstrapAxisRotationBlock } from "@/lib/requirements/requirementsBootstrapOrchestrationHints";
import type { OrganizeMemoryFacts } from "@/lib/requirements/requirementsOrganizeContext";
import { formatMandatoryReminderForModel, formatMemoryFactsForModel } from "@/lib/requirements/requirementsOrganizeContext";
import { pickConfiguredModelOverrideFromAgents } from "@/lib/requirements/singleChatAgentContext";
import { parseServiceFlowAnalyzeWire } from "@/lib/requirements/serviceFlowAnalyzeParse";
import { runServiceFlowProposalFallbackSynthesisOpenAI } from "@/lib/requirements/serviceFlowProposalFallbackSynthesis";
import {
  buildServiceFlowProposalRegenerationUserPayload,
  mergeServiceFlowUserFacingMessage,
  validateServiceFlowAnalyzeResponse,
  type ServiceFlowAnalyzeQualityIssueCode,
} from "@/lib/requirements/serviceFlowAnalyzeValidation";
import {
  buildAdviceToFlowQualityFailure,
  buildServiceFlowAdviceToFlowApplyRegenerationUserPayload,
  buildServiceFlowAdviceToFlowApplySystemPromptBlock,
  isAdviceToFlowApplyMode,
  serviceFlowRegenerationTracePrefix,
} from "@/lib/requirements/serviceFlowAdviceApplyMode";
import {
  buildServiceFlowAdviceRegenerationUserPayload,
  buildServiceFlowAdviceSystemPromptBlock,
  flowForServiceFlowAnalyzePrompt,
  isServiceFlowAdviceMode,
} from "@/lib/requirements/serviceFlowAdviceMode";
import { resolveServiceFlowAnalyzePromptModeFromPolicy } from "@/lib/requirements/serviceFlowAnalyzePromptMode";
import { buildServiceFlowAnalyzeJsonSchemaPromptBlock } from "@/lib/requirements/serviceFlowAnalyzeSchemaPrompt";
import {
  buildServiceFlowActorDefinitionSystemPromptBlock,
  buildServiceFlowDraftSystemPromptBlock,
  buildServiceFlowStepDefinitionSystemPromptBlock,
  buildServiceFlowSubIntentRegenerationUserPayload,
  getServiceFlowSubIntentFromPolicy,
} from "@/lib/requirements/serviceFlowSubIntent";

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
  | {
      ok: false;
      code: string;
      message: string;
      fallbackReason?: string;
      provider?: string;
      model?: string;
      calledAt?: string;
    };

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

export type BootstrapFinalQuestionSource =
  | "llm"
  | "llm_retry"
  | "proposal_synthesis"
  | "llm_proposal_regeneration"
  | "proposal_fallback_synthesis";

export type RequirementsSingleChatBootstrapOpenAIResult =
  | {
      ok: true;
      question: string;
      proposalDraft: BootstrapProposalDraftWire;
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
      finalQuestionSource: BootstrapFinalQuestionSource;
      proposalQualityRetryCount?: number;
      proposalQualityIssues?: readonly string[];
      suggestionQualityIssues?: readonly string[];
      /** 원문 LLM 응답(트렁케이트; 원인 추적) */
      rawResponseText?: string;
      /** retry user payload(트렁케이트; 원인 추적) */
      retryPromptText?: string;
      /** retry 응답(트렁케이트; 원인 추적) */
      retryRawResponseText?: string;
      /** 내부 축 id(primaryDecisionAxis와 동일 의미로 기록 가능) */
      internalAxis?: string | null;
      /** 사용자 대면 질문 스타일 태그(메타) */
      userFacingQuestionStyle?: string | null;
      /** 내부 오케스트레이션 어휘 없이 사용자 업무 언어로 정리되었는지 */
      userLanguageTransformApplied?: boolean;
      /** Chat Completions에 실제 사용된 모델 id */
      actualModel?: string;
      /** 워크스페이스 멤버 설정의 모델 오버라이드(호출에 미반영일 수 있음) */
      configuredModelOverride?: string | null;
      /** repair 적용 전 LLM question(품질 미달 시) */
      finalQuestionBeforeFallback?: string;
      /** 서버가 workflow 칩을 보강했는지 */
      fallbackGeneratedSuggestions?: boolean;
      /** strict validation 실패 후 proposal-first fallback synthesis 적용 */
      proposalFallbackApplied?: boolean;
      recoveryFallbackReason?: string;
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
      /** 원문 LLM 응답(트렁케이트) */
      rawResponseText?: string;
      /** JSON 파싱 실패 시 에러 요약 */
      parseError?: string;
      /** 파싱 성공 시(또는 부분 복구 성공 시) JSON 미리보기 */
      parsedJsonPreview?: string;
      /** quality retry user payload(트렁케이트) */
      retryPromptText?: string;
      /** retry 응답(트렁케이트) */
      retryRawResponseText?: string;
      /** fallback 직전 후보 question */
      finalQuestionBeforeFallback?: string;
      /** fallback reason 분류(서버 timeline 기록용) */
      fallbackReason?:
        | "NO_KEY"
        | "OPENAI_API_ERROR"
        | "EMPTY_RESPONSE"
        | "JSON_PARSE_FAILED"
        | "MODEL_RETURNED_SLOT_CATALOG"
        | "MISSING_QUESTION"
        | "QUESTION_QUALITY_REJECTED"
        | "RETRY_FAILED"
        | "REPAIRED_CONTEXT_USED"
        | "PROPOSAL_VALIDATION_FAILED"
        | "ROUTE_HANDLING_ERROR"
        | "UNKNOWN_BOOTSTRAP_ERROR"
        | string;
      fallbackText?: string;
      /** question 품질 이슈(가능하면) */
      questionQualityIssues?: readonly string[];
      /** retry count(가능하면) */
      questionQualityRetryCount?: number;
      proposalQualityRetryCount?: number;
      proposalQualityIssues?: readonly string[];
      /** final question source(가능하면) */
      finalQuestionSource?: BootstrapFinalQuestionSource;
      /** 성공 분기와 동일 — 라우트 예외 등에서 기록 */
      actualModel?: string;
      configuredModelOverride?: string | null;
    };

/** `ai-facilitator` 라우트 try/catch 등: 부트스트랩 실패 페이로드를 한 형태로 맞춘다 */
export function buildBootstrapOpenAiRouteHandlingExceptionResult(params: {
  errorMessage: string;
  configuredModelOverride?: string | null;
}): Extract<RequirementsSingleChatBootstrapOpenAIResult, { ok: false }> {
  const msg = String(params.errorMessage ?? "").slice(0, 400);
  const model = resolveOpenAiModelFromEnv();
  return {
    ok: false,
    code: "ROUTE",
    message: `bootstrap 라우트 예외: ${msg}`,
    fallbackReason: "ROUTE_HANDLING_ERROR",
    provider: "openai",
    model,
    actualModel: model,
    configuredModelOverride: params.configuredModelOverride ?? null,
    calledAt: new Date().toISOString(),
    responseText: "",
    rawResponseText: "",
    parseError: msg,
    questionQualityRetryCount: 0,
    questionQualityIssues: [],
    finalQuestionBeforeFallback: "",
  };
}

function truncateForTimeline(s: string, max: number): string {
  const t = String(s ?? "");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function logBootstrapLlmCall(payload: Record<string, unknown>): void {
  console.info("[bootstrap-llm-call]", payload);
}

function shouldLogBootstrapDiagnosisSteps(): boolean {
  return process.env.NODE_ENV !== "production" || String(process.env.JY_BOOTSTRAP_SERVER_LOG ?? "").trim() === "1";
}

function logBootstrapDiagnosis(step: string, payload: Record<string, unknown>): void {
  if (!shouldLogBootstrapDiagnosisSteps()) return;
  console.info("[bootstrap-diagnosis]", { step, ...payload });
}

function logBootstrapParseResult(payload: Record<string, unknown>): void {
  if (!shouldLogBootstrapDiagnosisSteps()) return;
  console.info("[bootstrap-parse-result]", payload);
}

export function isModelReturnedSlotCatalogPayload(parsed: Record<string, unknown>): boolean {
  const mode = typeof parsed.mode === "string" ? parsed.mode.trim() : "";
  const slots = (parsed as any).slots;
  const hasSlots = Array.isArray(slots) && slots.length > 0;
  const hasQuestion = Boolean(String((parsed as any).question ?? "").trim());
  return !hasQuestion && hasSlots && /bootstrap_phase1_compact/i.test(mode);
}

function tryExtractFirstJsonObjectSubstring(raw: string): string | null {
  const s = String(raw ?? "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\\\") {
        esc = true;
      } else if (ch === "\"") {
        inStr = false;
      }
      continue;
    }
    if (ch === "\"") {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function parseBootstrapInitializerJsonFromModelText(rawText: string): {
  ok: true;
  jsonText: string;
  parsed: Record<string, unknown>;
  parsedJsonPreview: string;
} | {
  ok: false;
  parseError: string;
  rawResponseText: string;
  attemptedJsonText?: string;
} {
  const raw = String(rawText ?? "").trim();
  const rawNoFence = stripJsonMarkdownFences(raw);
  const attempts: string[] = [];
  attempts.push(rawNoFence);
  const sub = tryExtractFirstJsonObjectSubstring(rawNoFence);
  if (sub) attempts.push(sub);

  let lastErr = "unknown";
  for (const candidate of attempts) {
    const c = String(candidate ?? "").trim();
    if (!c) continue;
    try {
      const parsed = JSON.parse(c) as Record<string, unknown>;
      return { ok: true, jsonText: c, parsed, parsedJsonPreview: truncateForTimeline(c, 4000) };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    ok: false,
    parseError: truncateForTimeline(lastErr, 360),
    rawResponseText: truncateForTimeline(raw, 4000),
    attemptedJsonText: sub ? truncateForTimeline(sub, 4000) : undefined,
  };
}

function extractSingleChatBootstrapFromJson(j: Record<string, unknown>): {
  question: string;
  proposalDraft: BootstrapProposalDraftWire | null;
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
  const proposalDraft = parseBootstrapProposalDraftFromJson(j.proposalDraft);
  return { question, proposalDraft, suggestions, allowCustomInput, suggestedSlots, orchestrationBootstrap, suggestedSlotReasons };
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
    return {
      ok: false,
      code: "NO_KEY",
      message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다.",
      fallbackReason: "NO_KEY",
      provider: "openai",
    };
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
  /** 서버 진단: projectId·UI 모델 오버라이드(실제 호출 모델과 다를 수 있음) */
  diagnosticMeta?: Readonly<{
    projectId?: string | null;
    configuredModelOverride?: string | null;
  }>;
}): Promise<RequirementsSingleChatBootstrapOpenAIResult> {
  const model = resolveOpenAiModelFromEnv();
  const configuredOverride = String(input.diagnosticMeta?.configuredModelOverride ?? "").trim() || null;
  const projectIdDiag = String(input.diagnosticMeta?.projectId ?? "").trim() || null;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const calledAtNoKey = new Date().toISOString();
  if (!apiKey) {
    logBootstrapDiagnosis("return_fail", {
      model,
      provider: "openai",
      fallbackReason: "NO_KEY",
      configuredModelOverride: configuredOverride,
      projectId: projectIdDiag,
    });
    return {
      ok: false,
      code: "NO_KEY",
      message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다.",
      fallbackReason: "NO_KEY",
      model,
      provider: "openai",
      calledAt: calledAtNoKey,
      promptText: undefined,
      responseText: "",
      rawResponseText: "",
      parseError: "",
      questionQualityIssues: [],
      questionQualityRetryCount: 0,
      finalQuestionBeforeFallback: "",
      fallbackText: "",
    };
  }

  logBootstrapDiagnosis("call_started", {
    projectId: projectIdDiag,
    model,
    configuredModelOverride: configuredOverride,
    hasApiKey: true,
  });
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
역할: planner/analyst/architect/(designer) 관점을 **내부적으로만** 검토한 뒤, **proposalDraft(primary)** 를 먼저 만들고, question(secondary)와 suggestions를 산출한다.
참여 AI 블록의 역할 문자열은 외부 6종(planner/analyst/architect/designer/reviewer/security)만 사용한다.
reasoningContributors·analyst/architect 관점은 orchestrationBootstrap 메타에만 두고, question·proposalDraft에 역할 이름·"AI 분석가" 등 **다른 화자 표현 금지**.

[bootstrap reasoning mode — proposal-driven]
1) 내부적으로 planner·analyst·architect 관점을 검토한다.
2) **proposalDraft**에 summary·actors·workflow(또는 stages)·capabilities를 프로젝트 설명에서 추론해 채운다(analyst는 질문자가 아니라 proposal contributor).
3) question은 secondary: proposalDraft를 사용자에게 검토·선택·수정 요청하는 짧은 CTA(물음표 최대 1개).
사용자에게 **빈 설계 질문 금지**("첫 단계는 무엇입니까?", "어떤 액터가 필요하신가요?" 등). proposalDraft 없이 question만 내는 출력은 invalid.

내부 decision 축 선택 우선순위(메타만, question에 축 id 노출 금지):
1 workflow branching 2 collaboration boundary 3 approval responsibility 4 automation level 5 quality validation 6 prototype boundary 7 editing authority 8 realtime vs batch.

proposal 정책(orchestration-first):
- [phase1_slot_catalog] label 문자열을 question에 그대로 넣지 말 것.
- 프로젝트 설명에 이미 적힌 사실만 되묻지 말 것.
- question에 도메인 실행 어절 최소 1개: 회의록·녹취·화자·요약·검토·수정·확정·자동화·실시간·배치·협업·산출물 등(프로젝트에 맞게).

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

JSON 스키마(마크다운·코드펜스 금지 — proposalDraft가 primary, question은 secondary):
{
  "proposalDraft": {
    "summary": "프로젝트 이해 1~2문장",
    "actors": ["역할1", "역할2"],
    "workflow": ["단계1", "단계2", "단계3"],
    "stages": [],
    "capabilities": ["핵심 기능1"]
  },
  "question": "위 초안이 맞는지 선택하거나 수정해 주세요.",
  "suggestions": ["추천안 적용", "일부 수정", "다른 대안 보기", "직접 입력"],
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

  // Bootstrap 안정성 우선: prompt 충돌·과잉 규칙을 줄이기 위해 힌트 블록은 짧게만 포함한다.
  const axisBlock = formatBootstrapAxisRotationBlock({ projectName: pn, projectDescription: pd }).slice(0, 600);

  const user = `[project]
name: ${pn}
type: ${pt}
description: ${pd.slice(0, 1400)}

${axisBlock}

[phase1_slot_catalog]
${baseCatalog.slice(0, 2500)}

출력은 반드시 위 [JSON 스키마] 형태의 "결과 JSON 오브젝트 1개"만.
- phase1_slot_catalog JSON(위 블록)을 그대로 재출력하지 마라.
- proposalDraft·question·suggestions·allowCustomInput 키는 반드시 포함하라.
- proposalDraft.workflow 또는 stages에 최소 2단계, actors에 최소 2명을 채울 것.
- slot catalog 원문을 복사하지 마라.`;

  const calledAt = new Date().toISOString();
  const promptText = `[system]\n${system}\n\n---\n\n[user]\n${user}`;
  const maxBootTokens = 680;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    maxTokens: maxBootTokens,
    responseFormatJsonObject: true,
  });

  logBootstrapLlmCall({
    projectId: projectIdDiag,
    phase: "initial",
    model,
    hasApiKey: true,
    responseFormatJsonObject: true,
    maxTokens: maxBootTokens,
    ok: res.ok,
    code: res.ok ? null : res.code,
    message: res.ok ? null : String(res.message).slice(0, 400),
    textLength: res.ok ? String(res.text ?? "").length : 0,
  });
  logBootstrapDiagnosis(res.ok ? "openai_ok" : "openai_failed", {
    model,
    configuredModelOverride: configuredOverride,
    code: res.ok ? null : res.code,
  });

  const baseFail = { model, promptText, provider: "openai" as const, calledAt };

  if (!res.ok) {
    logBootstrapDiagnosis("return_fail", { fallbackReason: "OPENAI_API_ERROR", code: res.code });
    return {
      ok: false,
      code: res.code,
      message: `OpenAI API 오류(${res.code}): ${res.message.slice(0, 400)}`,
      ...baseFail,
      fallbackReason: "OPENAI_API_ERROR",
      responseText: "",
      rawResponseText: "",
      parseError: "",
      questionQualityRetryCount: 0,
      questionQualityIssues: [],
      finalQuestionBeforeFallback: "",
    };
  }
  const text = res.text;
  logBootstrapDiagnosis("raw_response_received", { rawResponseLength: String(text ?? "").length });
  if (!text) {
    logBootstrapDiagnosis("return_fail", { fallbackReason: "EMPTY_RESPONSE" });
    return {
      ok: false,
      code: "EMPTY",
      message: "OpenAI 응답 본문이 비어 있습니다.",
      ...baseFail,
      responseText: "",
      rawResponseText: "",
      parseError: "",
      questionQualityRetryCount: 0,
      questionQualityIssues: [],
      finalQuestionBeforeFallback: "",
      fallbackReason: "EMPTY_RESPONSE",
    };
  }

  logBootstrapDiagnosis("parse_started", {});
  const parsedPack = parseBootstrapInitializerJsonFromModelText(String(text));
  if (!parsedPack.ok) {
    logBootstrapDiagnosis("parse_failed", { parseError: parsedPack.parseError });
    logBootstrapDiagnosis("return_fail", { fallbackReason: "JSON_PARSE_FAILED" });
    logBootstrapParseResult({
      parsedKeys: [],
      hasQuestion: false,
      hasSuggestions: false,
      hasSlots: false,
      mode: null,
      fallbackReason: "JSON_PARSE_FAILED",
    });
    return {
      ok: false,
      code: "PARSE",
      message: "bootstrap JSON 파싱 실패",
      ...baseFail,
      responseText: truncateForTimeline(String(text), 20_000),
      rawResponseText: parsedPack.rawResponseText,
      parseError: parsedPack.parseError,
      parsedJsonPreview: parsedPack.attemptedJsonText,
      questionQualityRetryCount: 0,
      questionQualityIssues: [],
      finalQuestionBeforeFallback: "",
      fallbackReason: "JSON_PARSE_FAILED",
    };
  }
  logBootstrapDiagnosis("parse_success", { parsedPreviewLen: parsedPack.parsedJsonPreview.length });

  let assistantRaw = parsedPack.jsonText;
  let payload = extractSingleChatBootstrapFromJson(parsedPack.parsed);

  if (!payload.proposalDraft && !payload.question) {
    const parsedKeys = Object.keys(parsedPack.parsed ?? {}).slice(0, 24);
    const mode = typeof (parsedPack.parsed as any).mode === "string" ? String((parsedPack.parsed as any).mode).trim() : null;
    const hasSlots = Array.isArray((parsedPack.parsed as any).slots) && (parsedPack.parsed as any).slots.length > 0;
    const fallbackReason = isModelReturnedSlotCatalogPayload(parsedPack.parsed)
      ? ("MODEL_RETURNED_SLOT_CATALOG" as const)
      : ("MISSING_QUESTION" as const);
    logBootstrapParseResult({
      parsedKeys,
      hasQuestion: false,
      hasSuggestions: Array.isArray((parsedPack.parsed as any).suggestions) && (parsedPack.parsed as any).suggestions.length > 0,
      hasSlots,
      mode,
      fallbackReason,
    });
    logBootstrapDiagnosis("proposal_missing", {});
    logBootstrapDiagnosis("return_fail", { fallbackReason });
    return {
      ok: false,
      code: "EMPTY",
      message:
        fallbackReason === "MODEL_RETURNED_SLOT_CATALOG"
          ? "모델이 결과 JSON 대신 phase1_slot_catalog(슬롯 목록) JSON을 반환했습니다."
          : "proposalDraft와 question이 모두 비어 있습니다.",
      ...baseFail,
      responseText: truncateForTimeline(String(text), 20_000),
      rawResponseText: truncateForTimeline(String(text), 4000),
      parsedJsonPreview: parsedPack.parsedJsonPreview,
      parseError: "",
      questionQualityRetryCount: 0,
      questionQualityIssues: [],
      finalQuestionBeforeFallback: "",
      fallbackReason,
    };
  }
  logBootstrapDiagnosis("bootstrap_extracted", {
    questionPreview: payload.question.slice(0, 80),
    proposalPreview: proposalDraftPreviewForDiagnostics(payload.proposalDraft),
  });
  logBootstrapParseResult({
    parsedKeys: Object.keys(parsedPack.parsed ?? {}).slice(0, 24),
    hasQuestion: Boolean(payload.question || payload.proposalDraft),
    hasSuggestions: payload.suggestions.length > 0,
    hasSlots: Array.isArray((parsedPack.parsed as any).slots) && (parsedPack.parsed as any).slots.length > 0,
    mode: typeof (parsedPack.parsed as any).mode === "string" ? String((parsedPack.parsed as any).mode).trim() : null,
    fallbackReason: null,
  });

  let promptTextOut = promptText;
  let questionQualityRetryCount = 0;
  let proposalQualityRetryCount = 0;
  let proposalQualityIssues: string[] = [];
  let questionQualityStatus: BootstrapQuestionQualityStatus = "pass";
  let questionQualityIssues: string[] = [];
  let finalQuestionSource: BootstrapFinalQuestionSource = "llm";
  const rawResponseText = truncateForTimeline(String(text), 4000);
  let retryPromptText: string | undefined = undefined;
  let retryRawResponseText: string | undefined = undefined;
  let proposalRegenPromptText: string | undefined = undefined;

  logBootstrapDiagnosis("proposal_validation_started", {});
  let proposalValidation = validateBootstrapProposalDraft({
    proposalDraft: payload.proposalDraft,
    question: payload.question,
  });

  while (!proposalValidation.ok && proposalQualityRetryCount < 2) {
    proposalQualityIssues = proposalValidation.issues.map(String);
    proposalQualityRetryCount += 1;
    const regenUser = buildBootstrapProposalRegenerationUserPayload({
      issues: proposalValidation.issues,
      rejectedQuestion: payload.question,
      rejectedProposalPreview: proposalDraftPreviewForDiagnostics(payload.proposalDraft),
    });
    proposalRegenPromptText = truncateForTimeline(regenUser, 4000);
    promptTextOut = `${promptTextOut}\n\n--- bootstrap_proposal_regeneration ---\n${regenUser}`;
    logBootstrapDiagnosis("proposal_regeneration_started", { proposalQualityRetryCount });

    const resProp = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
        { role: "assistant", content: assistantRaw },
        { role: "user", content: regenUser },
      ],
      temperature: 0.2,
      maxTokens: maxBootTokens,
      responseFormatJsonObject: true,
    });
    logBootstrapLlmCall({
      projectId: projectIdDiag,
      phase: `proposal_regen_${proposalQualityRetryCount}`,
      model,
      hasApiKey: true,
      responseFormatJsonObject: true,
      maxTokens: maxBootTokens,
      ok: resProp.ok,
      code: resProp.ok ? null : resProp.code,
      message: resProp.ok ? null : String(resProp.message).slice(0, 400),
      textLength: resProp.ok ? String(resProp.text ?? "").length : 0,
    });

    if (resProp.ok && resProp.text) {
      const parsedProp = parseBootstrapInitializerJsonFromModelText(String(resProp.text));
      if (parsedProp.ok) {
        const pProp = extractSingleChatBootstrapFromJson(parsedProp.parsed);
        assistantRaw = parsedProp.jsonText;
        payload = {
          ...payload,
          ...pProp,
          orchestrationBootstrap: {
            ...(payload.orchestrationBootstrap ?? {}),
            ...(pProp.orchestrationBootstrap ?? {}),
          },
        };
      }
    }
    proposalValidation = validateBootstrapProposalDraft({
      proposalDraft: payload.proposalDraft,
      question: payload.question,
    });
  }

  if (!proposalValidation.ok || !payload.proposalDraft) {
    logBootstrapDiagnosis("proposal_validation_failed", { issues: proposalValidation.issues });
    logBootstrapDiagnosis("proposal_regeneration_exhausted", { proposalQualityRetryCount });
    proposalQualityIssues = proposalValidation.issues.map(String);
    logBootstrapDiagnosis("proposal_fallback_synthesis_started", { issues: proposalQualityIssues });
    const fallbackSynth = await runBootstrapProposalFallbackSynthesisOpenAI({
      projectName: pn,
      projectDescription: pd,
      projectType: pt,
      failureIssues: proposalQualityIssues,
      rejectedProposalPreview: proposalDraftPreviewForDiagnostics(payload.proposalDraft),
      rejectedQuestion: payload.question,
    });
    promptTextOut = `${promptTextOut}\n\n--- bootstrap_proposal_fallback_synthesis ---\n${fallbackSynth.promptText ?? ""}`;
    if (fallbackSynth.ok) {
      logBootstrapDiagnosis("proposal_fallback_synthesis_ok", { questionPreview: fallbackSynth.question.slice(0, 120) });
      payload = {
        ...payload,
        proposalDraft: fallbackSynth.proposalDraft,
        question: fallbackSynth.question,
        suggestions: fallbackSynth.suggestions.length ? fallbackSynth.suggestions : payload.suggestions,
        allowCustomInput: fallbackSynth.allowCustomInput,
      };
      finalQuestionSource = "proposal_fallback_synthesis";
    } else {
      logBootstrapDiagnosis("proposal_fallback_synthesis_failed", { code: fallbackSynth.code });
      logBootstrapDiagnosis("return_fail", {
        fallbackReason: "PROPOSAL_VALIDATION_FAILED",
        issues: proposalValidation.issues,
      });
      return {
        ok: false,
        code: "PROPOSAL",
        message: "bootstrap proposalDraft 검증 실패(LLM regeneration·fallback synthesis 후에도 proposal-first 규칙 미충족)",
        ...baseFail,
        promptText: promptTextOut,
        responseText: truncateForTimeline(String(text), 20_000),
        rawResponseText,
        parsedJsonPreview: parsedPack.parsedJsonPreview,
        parseError: "",
        questionQualityRetryCount: 0,
        questionQualityIssues: proposalQualityIssues,
        proposalQualityRetryCount,
        finalQuestionBeforeFallback: payload.question.slice(0, 200),
        fallbackReason: "PROPOSAL_VALIDATION_FAILED",
      };
    }
  } else {
    payload = {
      ...payload,
      question: synthesizeBootstrapUserMessageFromProposalDraft(payload.proposalDraft, payload.question),
    };
    finalQuestionSource = proposalQualityRetryCount > 0 ? "llm_proposal_regeneration" : "proposal_synthesis";
  }
  logBootstrapDiagnosis("proposal_synthesis_applied", { questionPreview: payload.question.slice(0, 120) });

  if (!payload.question.trim()) {
    return {
      ok: false,
      code: "EMPTY",
      message: "proposalDraft 합성 후 사용자 메시지가 비어 있습니다.",
      ...baseFail,
      fallbackReason: "PROPOSAL_VALIDATION_FAILED",
      questionQualityRetryCount: 0,
      questionQualityIssues: [],
    };
  }

  logBootstrapDiagnosis("quality_check_started", {});
  const q0 = analyzeBootstrapQuestionQuality({ question: payload.question, projectDescription: pd });
  if (q0.ok) {
    questionQualityStatus = "pass";
    questionQualityIssues = [];
  } else {
    const firstIssues = q0.issues.map(String);
    logBootstrapDiagnosis("quality_check_failed", {
      fallbackReason: "QUESTION_QUALITY_REJECTED",
      issues: firstIssues,
      questionPreview: payload.question.slice(0, 120),
    });
    questionQualityRetryCount = 1;
    const retryUser = buildBootstrapQuestionRetryUserPayload({
      issues: q0.issues,
      rejectedQuestion: payload.question,
    });
    retryPromptText = truncateForTimeline(retryUser, 4000);
    promptTextOut = `${promptText}\n\n--- bootstrap_question_retry ---\n${retryUser}`;

    logBootstrapDiagnosis("retry_started", { questionQualityRetryCount: 1 });
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
      maxTokens: maxBootTokens,
      responseFormatJsonObject: true,
    });
    logBootstrapLlmCall({
      projectId: projectIdDiag,
      phase: "retry",
      model,
      hasApiKey: true,
      responseFormatJsonObject: true,
      maxTokens: maxBootTokens,
      ok: res2.ok,
      code: res2.ok ? null : res2.code,
      message: res2.ok ? null : String(res2.message).slice(0, 400),
      textLength: res2.ok ? String(res2.text ?? "").length : 0,
    });
    if (!res2.ok) {
      logBootstrapDiagnosis("openai_failed", { phase: "retry", code: res2.code });
    }

    if (res2.ok && res2.text) {
      retryRawResponseText = truncateForTimeline(String(res2.text), 4000);
      const parsed2 = parseBootstrapInitializerJsonFromModelText(String(res2.text));
      if (parsed2.ok) {
        const p2 = extractSingleChatBootstrapFromJson(parsed2.parsed);
        if (p2.proposalDraft || p2.question) {
          assistantRaw = parsed2.jsonText;
          payload = {
            ...payload,
            ...p2,
            orchestrationBootstrap: {
              ...(payload.orchestrationBootstrap ?? {}),
              ...(p2.orchestrationBootstrap ?? {}),
            },
          };
          if (payload.proposalDraft) {
            payload = {
              ...payload,
              question: synthesizeBootstrapUserMessageFromProposalDraft(payload.proposalDraft, payload.question),
            };
          }
          logBootstrapDiagnosis("retry_success", { questionPreview: payload.question.slice(0, 120) });
        } else {
          logBootstrapDiagnosis("retry_question_missing", {});
        }
      } else {
        logBootstrapDiagnosis("retry_parse_failed", { parseError: parsed2.parseError });
      }
    } else {
      logBootstrapDiagnosis("retry_openai_no_body", { ok: res2.ok });
    }

    const q1 = analyzeBootstrapQuestionQuality({ question: payload.question, projectDescription: pd });
    if (q1.ok) {
      questionQualityStatus = "retry_passed";
      questionQualityIssues = firstIssues;
      finalQuestionSource = "llm_retry";
      logBootstrapDiagnosis("retry_passed_quality", {});
    } else {
      questionQualityIssues = [...new Set([...firstIssues, ...q1.issues.map(String)])];
      let questionRecoveredAfterProposalRegen = false;
      const regenUser = buildBootstrapProposalRegenerationUserPayload({
        issues: [...proposalValidation.issues, "question_first_without_proposal"],
        rejectedQuestion: payload.question,
        rejectedProposalPreview: proposalDraftPreviewForDiagnostics(payload.proposalDraft),
      });
      proposalRegenPromptText = truncateForTimeline(regenUser, 4000);
      logBootstrapDiagnosis("proposal_regeneration_after_question_retry", {});
      const res3 = await postOpenAiChatCompletion({
        apiKey,
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
          { role: "assistant", content: assistantRaw },
          { role: "user", content: regenUser },
        ],
        temperature: 0.2,
        maxTokens: maxBootTokens,
        responseFormatJsonObject: true,
      });
      if (res3.ok && res3.text) {
        const parsed3 = parseBootstrapInitializerJsonFromModelText(String(res3.text));
        if (parsed3.ok) {
          const p3 = extractSingleChatBootstrapFromJson(parsed3.parsed);
          if (p3.proposalDraft) {
            payload = {
              ...payload,
              ...p3,
              orchestrationBootstrap: {
                ...(payload.orchestrationBootstrap ?? {}),
                ...(p3.orchestrationBootstrap ?? {}),
              },
            };
            payload = {
              ...payload,
              question: synthesizeBootstrapUserMessageFromProposalDraft(payload.proposalDraft!, payload.question),
            };
            const qAfter = analyzeBootstrapQuestionQuality({ question: payload.question, projectDescription: pd });
            if (qAfter.ok) {
              questionQualityStatus = "retry_passed";
              finalQuestionSource = "llm_proposal_regeneration";
              questionRecoveredAfterProposalRegen = true;
              logBootstrapDiagnosis("proposal_regeneration_after_question_retry_ok", {});
            } else {
              questionQualityIssues = [...new Set([...questionQualityIssues, ...qAfter.issues.map(String)])];
            }
          }
        }
      }
      if (!questionRecoveredAfterProposalRegen) {
        logBootstrapDiagnosis("proposal_fallback_synthesis_started", { issues: questionQualityIssues });
        const fallbackSynth = await runBootstrapProposalFallbackSynthesisOpenAI({
          projectName: pn,
          projectDescription: pd,
          projectType: pt,
          failureIssues: questionQualityIssues,
          rejectedProposalPreview: proposalDraftPreviewForDiagnostics(payload.proposalDraft),
          rejectedQuestion: payload.question,
        });
        promptTextOut = `${promptTextOut}\n\n--- bootstrap_proposal_fallback_synthesis ---\n${fallbackSynth.promptText ?? ""}`;
        if (fallbackSynth.ok) {
          logBootstrapDiagnosis("proposal_fallback_synthesis_ok", { questionPreview: fallbackSynth.question.slice(0, 120) });
          payload = {
            ...payload,
            proposalDraft: fallbackSynth.proposalDraft,
            question: fallbackSynth.question,
            suggestions: fallbackSynth.suggestions.length ? fallbackSynth.suggestions : payload.suggestions,
            allowCustomInput: fallbackSynth.allowCustomInput,
          };
          questionQualityStatus = "retry_passed";
          finalQuestionSource = "proposal_fallback_synthesis";
          questionRecoveredAfterProposalRegen = true;
        } else {
          logBootstrapDiagnosis("proposal_fallback_synthesis_failed", { code: fallbackSynth.code });
          questionQualityStatus = "retry_failed_repaired";
          logBootstrapDiagnosis("return_fail", { fallbackReason: "PROPOSAL_VALIDATION_FAILED" });
          return {
            ok: false,
            code: "PROPOSAL",
            message: "bootstrap 질문 품질·proposal 검증 실패(LLM regeneration·fallback synthesis 소진)",
            ...baseFail,
            promptText: promptTextOut,
            rawResponseText,
            questionQualityRetryCount,
            questionQualityIssues,
            proposalQualityRetryCount,
            proposalQualityIssues,
            fallbackReason: "PROPOSAL_VALIDATION_FAILED",
          };
        }
      }
    }
  }

  const sugPack = filterBootstrapInterviewSuggestions({
    suggestions: payload.suggestions,
    question: payload.question,
  });

  const internalAxis = String(payload.orchestrationBootstrap?.primaryDecisionAxis ?? "").trim() || null;
  const userFacingQuestionStyle =
    String(payload.orchestrationBootstrap?.userFacingQuestionStyle ?? "").trim() || null;
  const userLanguageTransformApplied = payload.question ? !detectInternalOrchestrationVocabInUserQuestion(payload.question) : false;

  const proposalFallbackApplied = finalQuestionSource === "proposal_fallback_synthesis";

  logBootstrapDiagnosis("return_ok", {
    finalQuestionSource,
    questionQualityStatus,
    questionQualityRetryCount,
    fallbackGeneratedSuggestions: sugPack.fallbackGeneratedSuggestions,
    proposalFallbackApplied,
  });

  return {
    ok: true,
    question: payload.question,
    proposalDraft: payload.proposalDraft!,
    suggestions: [...sugPack.suggestions],
    allowCustomInput: payload.allowCustomInput,
    suggestedSlots: payload.suggestedSlots,
    ...(payload.orchestrationBootstrap ? { orchestrationBootstrap: payload.orchestrationBootstrap } : {}),
    ...(payload.suggestedSlotReasons.length ? { suggestedSlotReasons: [...payload.suggestedSlotReasons] } : {}),
    model,
    actualModel: model,
    configuredModelOverride: configuredOverride,
    promptText: promptTextOut,
    provider: "openai",
    calledAt,
    questionQualityStatus,
    questionQualityIssues,
    questionQualityRetryCount,
    finalQuestionSource,
    ...(sugPack.issues.length ? { suggestionQualityIssues: sugPack.issues } : {}),
    ...(sugPack.fallbackGeneratedSuggestions ? { fallbackGeneratedSuggestions: true } : {}),
    rawResponseText,
    ...(retryPromptText ? { retryPromptText } : {}),
    ...(retryRawResponseText ? { retryRawResponseText } : {}),
    ...(proposalQualityRetryCount > 0 ? { proposalQualityRetryCount, proposalQualityIssues } : {}),
    ...(proposalFallbackApplied
      ? { proposalFallbackApplied: true, recoveryFallbackReason: "PROPOSAL_VALIDATION_FAILED" }
      : {}),
    ...(internalAxis ? { internalAxis } : {}),
    ...(userFacingQuestionStyle ? { userFacingQuestionStyle } : {}),
    userLanguageTransformApplied,
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
      promptText: string;
      proposalFallbackApplied?: boolean;
      recoveryFallbackReason?: "SERVICE_FLOW_PROPOSAL_VALIDATION_FAILED";
    }
  | { ok: false; code: string; message: string; promptText?: string };

function interviewStateJsonForAnalyzer(state: ProblemInterviewState): string {
  return JSON.stringify(problemInterviewStateToAnalyzerWire(state));
}

function safeText(v: unknown, max = 520): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
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
  readonly responsePolicy?: unknown;
}): Promise<ServiceFlowAnalyzeOpenAiResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  const model = resolveOpenAiModelFromEnv();
  const nowIso = new Date().toISOString();
  const promptMode = resolveServiceFlowAnalyzePromptModeFromPolicy(input.responsePolicy);
  const adviceToFlowApplyMode = promptMode === "advice_to_flow_apply";
  const adviceMode = promptMode === "advice";
  const actorDefinitionMode = promptMode === "actor_definition";
  const flowDraftMode = promptMode === "flow_draft";
  const flowStepDefinitionMode = promptMode === "flow_step_definition";
  const serviceFlowSubIntent = getServiceFlowSubIntentFromPolicy(input.responsePolicy);
  const flowForPrompt = flowForServiceFlowAnalyzePrompt(input.currentFlow, input.responsePolicy);
  const flowJson = JSON.stringify(flowForPrompt ?? { createdAt: nowIso, updatedAt: nowIso, actors: [], steps: [] }).slice(0, 22_000);
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

  const system = adviceToFlowApplyMode
    ? `${workspaceAiMemberSystemPrefix("actor_flow")}${sfAgentInsert}당신은 service-flow 단계의 **AI 기획자(코디네이터)** 입니다.

${buildServiceFlowAdviceToFlowApplySystemPromptBlock()}

목표:
- 직전 advice를 바탕으로 updatedFlow.actors·updatedFlow.steps를 **실제로 생성**한다.
- assistantMessage에 예상 액터·예상 흐름 초안을 제시한다.
- nextQuestion은 null이거나 검토 CTA 1문장만.
- quickReplies는 2~3개(검토·수정용).

금지:
- "정의해 보겠습니다"만 말하고 steps를 비우기
- 응답은 JSON 1개만(마크다운/코드펜스 금지).

의도(intent): add_step|update_step|show_summary|unclear
Readiness: actorsReady/stepsReady/readyForNext를 생성 결과에 맞게 true로 반영.`
    : actorDefinitionMode
    ? `${workspaceAiMemberSystemPrefix("actor_flow")}${sfAgentInsert}당신은 service-flow 단계의 **AI 기획자(코디네이터)** 입니다.

${buildServiceFlowActorDefinitionSystemPromptBlock()}

목표:
- updatedFlow.actors를 최소 2개 이상 생성한다.
- assistantMessage에 액터별 역할·책임을 번호/불릿으로 제시한다.
- steps는 비워도 되나, 미래형 선언만 하지 않는다.

금지:
- APPLY_PROPOSAL·대안 Viewer·"정의해 보겠습니다"만 말하기
- 응답은 JSON 1개만(마크다운/코드펜스 금지).

의도(intent): add_actor|update_actor|show_summary|unclear`
    : flowDraftMode
    ? `${workspaceAiMemberSystemPrefix("actor_flow")}${sfAgentInsert}당신은 service-flow 단계의 **AI 기획자(코디네이터)** 입니다.

${buildServiceFlowDraftSystemPromptBlock()}

목표:
- updatedFlow.actors(최소 2)와 updatedFlow.steps(최소 3)를 생성한다.
- assistantMessage에 실제 단계 목록을 표시한다.

금지:
- GENERATE_ALTERNATIVE·이 대안 적용·다른 대안 다시 생성 UX
- "정의해 보겠습니다"만 말하고 steps를 비우기
- 응답은 JSON 1개만(마크다운/코드펜스 금지).

의도(intent): add_step|update_step|show_summary|unclear`
    : flowStepDefinitionMode
    ? `${workspaceAiMemberSystemPrefix("actor_flow")}${sfAgentInsert}당신은 service-flow 단계의 **AI 기획자(코디네이터)** 입니다.

${buildServiceFlowStepDefinitionSystemPromptBlock()}

목표:
- updatedFlow.steps를 최소 3개 이상 생성하고 primaryActorId를 actors에 연결한다.
- assistantMessage에 실제 단계 목록을 표시한다.

금지:
- APPLY_PROPOSAL·대안 Viewer·미래형 선언만
- 응답은 JSON 1개만(마크다운/코드펜스 금지).

의도(intent): add_step|update_step|show_summary|unclear`
    : adviceMode
      ? `${workspaceAiMemberSystemPrefix("actor_flow")}${sfAgentInsert}당신은 service-flow 단계의 **AI 기획자(코디네이터)** 입니다.

${buildServiceFlowAdviceSystemPromptBlock()}

목표:
- assistantMessage에 사용자가 요청한 절차·검토·승인·운영 방식을 **단계별로 충분히** 작성한다.
- updatedFlow는 currentFlow를 유지하거나 최소 변경만 한다.
- nextQuestion은 null이거나 "이 절차를 서비스 흐름에 반영할까요?" 수준 1문장만.
- quickReplies는 0~2개(선택, 반영 요청 시에만).

금지:
- "제안합니다" 선언만 하고 구체 절차 없이 끝내기
- "다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요." 같은 flow proposal CTA
- 대안 비교·ALTERNATIVE·Viewer 유도 문구
- 응답은 JSON 1개만(마크다운/코드펜스 금지).

의도(intent): show_summary|delegate_to_ai|unclear
Readiness: currentFlow 기준으로 score만 반영(0~100).`
      : `${workspaceAiMemberSystemPrefix("actor_flow")}${sfAgentInsert}당신은 service-flow 단계의 **내부 flow proposal contributor(analyst)** 입니다.
사용자에게 보이는 톤은 **AI 기획자(코디네이터)** — 질문 위주 인터뷰어가 아닙니다.

이 단계의 목적: 아이디어 구체화 산출물을 바탕으로 서비스 흐름(액터·단계·담당)을 **제안·검증·보정**한다.
"이제 흐름을 정의해볼까요?" 같은 백지 디스커버리는 실패다.

목표:
- updatedFlow를 의미 기반으로 갱신한다.
- assistantMessage는 **구조화된 proposal** (draft 중심, question-first 금지).
- nextQuestion은 null이거나 **단일 CTA** 1문장만(assistantMessage와 중복 질문 금지).
- quickReplies는 proposal 검토용 2~3개(LLM 생성, 서비스명·도메인 하드코딩 선택지 금지).

assistantMessage 형식(초안·인터뷰 시작 턴에 필수):
1) 한 줄 요약(프로젝트 맥락 반영)
2) 빈 줄
3) "예상 액터" + 불릿 목록(updatedFlow.actors와 일치)
4) 빈 줄
5) "예상 흐름" + 번호 목록(updatedFlow.steps와 일치)
6) 빈 줄
7) 단일 CTA 한 줄 (예: "다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.")

금지:
- assistantMessage와 nextQuestion에 서로 다른 질문 2개 이상
- "누락/수정할 단계가 있습니까?"와 "위 흐름이 맞는지…"를 동시에 넣기
- 액터·단계를 문장 속에만 나열하고 updatedFlow에는 비우기
- 프로젝트명 키워드 if/else 하드코딩

규칙:
- ideationAssets가 있으면 source of truth로 우선 사용(빈 flow여도 초안 추론).
- assistantMessage의 액터·단계는 updatedFlow와 **반드시 일치**.
- 최초·인터뷰 시작: updatedFlow.actors >= 2, steps >= 3, readiness.score >= 1, quickReplies 2~3개.
- nextQuestion이 null이어도 assistantMessage 마지막에 CTA 1개는 있어야 함.
- show_summary 요청 시 intent=show_summary, 현재 flow 목록 출력.
- 기능/UI 상세는 이 단계에서 확정하지 말고 "세부 기능 정의는 다음 기능정리 단계에서 진행됩니다."로 안내.
- 응답은 JSON 1개만(마크다운/코드펜스 금지).

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
  "assistantMessage": "${adviceMode ? "단계별 기획 조언 본문(충분한 길이)" : "사용자에게 보여줄 메시지(짧게)"}",
  "updatedFlow": { "createdAt": "...", "updatedAt": "...", "actors": [], "steps": [] },
  "intent": "${adviceMode ? "show_summary|delegate_to_ai|unclear" : "add_actor|update_actor|add_step|update_step|update_mapping|show_summary|delegate_to_ai|unclear"}",
  "nextQuestion": "질문 한 문장?" | null,
  "quickReplies": ["선택지1", "선택지2", "선택지3"] | null,
  "readiness": { "score": 0, "actorsReady": true, "stepsReady": true, "mappingReady": true, "readyForNext": true }
}

${buildServiceFlowAnalyzeJsonSchemaPromptBlock()}`;

  let promptTextSf = `[service-flow-analyze]\n[system]\n${system}\n\n[user]\n${user}\n[internalRole=analyst userFacing=coordinator]`;

  type ParsedSfPack = {
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

  const callModel = async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ) => {
    const res = await postOpenAiChatCompletion({
      apiKey,
      model,
      messages,
      temperature: 0.18,
      responseFormatJsonObject: true,
    });
    if (!res.ok) {
      return { ok: false as const, code: res.code, message: res.message.slice(0, 400), text: "" };
    }
    const text = res.text;
    if (!text) return { ok: false as const, code: "EMPTY", message: "응답 본문이 비어 있습니다.", text: "" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { ok: false as const, code: "PARSE", message: "JSON 파싱 실패", text };
    }
    return { ok: true as const, parsed, text };
  };

  let assistantRaw = "";
  let qualityRetryCount = 0;
  let lastQualityIssues: string[] = [];
  const baseMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const tryValidateModelOutput = (
    parsed: unknown,
    text: string,
  ): { ok: true; data: ParsedSfPack } | { ok: false; rejected: ParsedSfPack } | null => {
    assistantRaw = text;
    const parsedPack = parseServiceFlowAnalyzeWire(parsed, nowIso);
    if (!parsedPack.ok) return null;

    const data: ParsedSfPack = {
      ...parsedPack.data,
      intent: parsedPack.data.intent as ServiceFlowAnalyzeIntent,
    };

    const validation = validateServiceFlowAnalyzeResponse({
      parsed: data,
      userMessage: input.userMessage,
      currentFlow: input.currentFlow,
      responsePolicy: input.responsePolicy,
    });

    if (validation.ok) return { ok: true, data };
    lastQualityIssues = validation.issues.map(String);
    return { ok: false, rejected: data };
  };

  let r = await callModel(baseMessages);
  if (!r.ok && (r.code === "PARSE" || r.code === "EMPTY")) {
    r = await callModel([
      ...baseMessages,
      {
        role: "user",
        content: `${user}\n\n[재시도] 직전 출력이 스키마에 맞지 않았습니다. 위 스키마의 JSON만 다시 출력하세요.`,
      },
    ]);
  }
  if (!r.ok) return { ok: false, code: r.code, message: r.message, promptText: promptTextSf };

  let attempt = tryValidateModelOutput(r.parsed, r.text);
  if (!attempt) {
    const retry = await callModel([
      ...baseMessages,
      {
        role: "user",
        content: `${user}\n\n[재시도] updatedFlow·assistantMessage JSON 스키마를 지켜 다시 출력하세요.`,
      },
    ]);
    if (!retry.ok) return { ok: false, code: retry.code, message: retry.message, promptText: promptTextSf };
    attempt = tryValidateModelOutput(retry.parsed, retry.text);
  }

  const regenerationTracePrefix = serviceFlowRegenerationTracePrefix({
    adviceMode: promptMode === "advice",
    adviceToFlowApplyMode,
  });

  while (attempt && !attempt.ok && qualityRetryCount < 2) {
    qualityRetryCount += 1;
    promptTextSf = `${promptTextSf}\n\n--- ${regenerationTracePrefix}_regeneration_started ---\n${lastQualityIssues.join(", ")}`;
    const regenUser =
      promptMode === "advice"
        ? buildServiceFlowAdviceRegenerationUserPayload({
            issues: lastQualityIssues,
            rejectedAssistantPreview: attempt.rejected.assistantMessage,
          })
        : promptMode === "advice_to_flow_apply"
          ? buildServiceFlowAdviceToFlowApplyRegenerationUserPayload({
              issues: lastQualityIssues,
              rejectedAssistantPreview: attempt.rejected.assistantMessage,
            })
          : promptMode === "actor_definition" || promptMode === "flow_step_definition"
            ? buildServiceFlowSubIntentRegenerationUserPayload({
                subIntent: serviceFlowSubIntent ?? "general_service_flow",
                issues: lastQualityIssues as ServiceFlowAnalyzeQualityIssueCode[],
                rejectedAssistantPreview: attempt.rejected.assistantMessage,
              })
            : buildServiceFlowProposalRegenerationUserPayload({
                issues: lastQualityIssues as ServiceFlowAnalyzeQualityIssueCode[],
                rejectedAssistantPreview: attempt.rejected.assistantMessage,
                rejectedNextQuestion: attempt.rejected.nextQuestion,
              });
    promptTextSf = `${promptTextSf}\n\n--- ${regenerationTracePrefix}_regeneration_${qualityRetryCount} ---\n${regenUser}`;

    const regen = await callModel([
      ...baseMessages,
      { role: "assistant", content: assistantRaw },
      { role: "user", content: regenUser },
    ]);
    if (!regen.ok) return { ok: false, code: regen.code, message: regen.message, promptText: promptTextSf };
    attempt = tryValidateModelOutput(regen.parsed, regen.text);
    promptTextSf += attempt?.ok
      ? `\n\n--- ${regenerationTracePrefix}_regeneration_result_ok ---`
      : `\n\n--- ${regenerationTracePrefix}_regeneration_result_failed ---\n${lastQualityIssues.join(", ")}`;
  }

  const validated = attempt?.ok ? attempt.data : null;

  if (validated) {
    const updatedFlow =
      adviceMode && !adviceToFlowApplyMode && input.currentFlow
        ? { ...input.currentFlow, ...validated.updatedFlow }
        : validated.updatedFlow;
    return {
      ok: true,
      model,
      promptText: promptTextSf,
      data: {
        ...validated,
        assistantMessage: validated.assistantMessage,
        nextQuestion: validated.nextQuestion,
        updatedFlow,
        intent: validated.intent as ServiceFlowAnalyzeIntent,
      },
    };
  }

  const rejectedPack = attempt && !attempt.ok ? attempt.rejected : undefined;

  if (adviceToFlowApplyMode) {
    promptTextSf += `\n\n--- service_flow_advice_to_flow_validation_failed ---\n${lastQualityIssues.join(", ") || "unknown"}`;

    const finalRegenUser = buildServiceFlowAdviceToFlowApplyRegenerationUserPayload({
      issues: lastQualityIssues.length ? lastQualityIssues : ["advice_to_flow_apply_missing_steps"],
      rejectedAssistantPreview: rejectedPack?.assistantMessage ?? "",
    });

    promptTextSf += `\n\n--- service_flow_advice_to_flow_final_regeneration ---\n${finalRegenUser}`;

    const finalRegen = await callModel([
      ...baseMessages,
      ...(assistantRaw ? [{ role: "assistant" as const, content: assistantRaw }] : []),
      { role: "user", content: finalRegenUser },
    ]);

    if (!finalRegen.ok) {
      promptTextSf += `\n\n--- service_flow_advice_to_flow_final_regeneration_failed ---\n${finalRegen.code}: ${finalRegen.message}`;
      return buildAdviceToFlowQualityFailure(promptTextSf);
    }

    const finalAttempt = tryValidateModelOutput(finalRegen.parsed, finalRegen.text);

    if (finalAttempt?.ok) {
      promptTextSf += `\n\n--- service_flow_advice_to_flow_final_regeneration_result_ok ---`;
      return {
        ok: true,
        model,
        promptText: promptTextSf,
        data: {
          ...finalAttempt.data,
          assistantMessage: finalAttempt.data.assistantMessage,
          nextQuestion: finalAttempt.data.nextQuestion,
          updatedFlow: finalAttempt.data.updatedFlow,
          intent: finalAttempt.data.intent as ServiceFlowAnalyzeIntent,
        },
      };
    }

    promptTextSf += `\n\n--- service_flow_advice_to_flow_quality_failed ---\n${lastQualityIssues.join(", ") || "unknown"}`;
    return buildAdviceToFlowQualityFailure(promptTextSf);
  }

  if (adviceMode) {
    promptTextSf += `\n\n--- service_flow_advice_validation_failed ---\n${lastQualityIssues.join(", ") || "unknown"}`;
    promptTextSf += `\n\n--- service_flow_advice_quality_failed ---`;
    return {
      ok: false,
      code: "ADVICE_QUALITY",
      message: "기획 조언 응답 품질 기준을 충족하지 못했습니다. 다시 요청해 주세요.",
      promptText: promptTextSf,
    };
  }

  promptTextSf += `\n\n--- service_flow_validation_failed ---\n${lastQualityIssues.join(", ") || "unknown"}`;
  promptTextSf += `\n\n--- service_flow_fallback_synthesis_started ---`;

  const fallback = await runServiceFlowProposalFallbackSynthesisOpenAI({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    ideationAssets: input.ideationAssets,
    userMessage: input.userMessage,
    currentFlow: input.currentFlow,
    recentMessages: input.recentMessages,
    failureIssues: lastQualityIssues,
    rejectedAssistantPreview: rejectedPack?.assistantMessage ?? "",
    rejectedNextQuestion: rejectedPack?.nextQuestion ?? null,
    rejectedUpdatedFlowPreview: JSON.stringify(rejectedPack?.updatedFlow ?? input.currentFlow ?? {}).slice(0, 2000),
    responsePolicy: input.responsePolicy,
    serviceFlowSubIntent,
  });

  promptTextSf += `\n\n--- service_flow_fallback_synthesis ---\n${fallback.promptText ?? ""}`;

  if (fallback.ok) {
    promptTextSf += `\n\n--- service_flow_fallback_synthesis_result_ok ---`;
    const mergedAssistant = mergeServiceFlowUserFacingMessage(
      fallback.data.assistantMessage,
      fallback.data.nextQuestion,
    );
    return {
      ok: true,
      model: fallback.model,
      promptText: promptTextSf,
      proposalFallbackApplied: true,
      recoveryFallbackReason: "SERVICE_FLOW_PROPOSAL_VALIDATION_FAILED",
      data: {
        assistantMessage: mergedAssistant,
        updatedFlow: fallback.data.updatedFlow,
        intent: fallback.data.intent as ServiceFlowAnalyzeIntent,
        nextQuestion: fallback.data.nextQuestion,
        quickReplies: fallback.data.quickReplies,
        readiness: fallback.data.readiness,
      },
    };
  }

  promptTextSf += `\n\n--- service_flow_fallback_synthesis_result_failed ---\n${fallback.code}: ${fallback.message}`;

  return {
    ok: false,
    code: "QUALITY",
    message: `service-flow proposal-first 검증 실패: ${lastQualityIssues.join(", ") || "unknown"}`,
    promptText: promptTextSf,
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
