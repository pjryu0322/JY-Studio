import type {
  RequirementsPromptTimelineAgentRef,
  RequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsStateJson";
import type { SingleChatSelectedAgentWire } from "@/lib/requirements/singleChatAgentContext";

export const IDEATION_BOOTSTRAP_PROMPT_TIMELINE_AI_MEMBER = "AI 기획자" as const;
export const IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION = "bootstrapInterview" as const;
export const IDEATION_BOOTSTRAP_PROMPT_TIMELINE_STAGE = "ideation" as const;

/** @deprecated 서버는 `buildIdeationBootstrapContextualFallbackQuestion` 우선 사용 */
export const IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION = "무엇을 만들고 싶은가?" as const;

/** LLM 부트스트략 불가 시에도 프로젝트명·설명·유형을 반영한 한 문장 질문(무조건 generic 금지) */
export function buildIdeationBootstrapContextualFallbackQuestion(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
}): string {
  const name = input.projectName.trim() || "이 프로젝트";
  const desc = input.projectDescription.trim().replace(/\s+/g, " ");
  const typeSuffix = input.projectType?.trim() ? ` (${input.projectType.trim()})` : "";
  const snippet = desc.slice(0, 160).trim();
  if (snippet.length >= 12) {
    return `${name}${typeSuffix} 준비 중이라고 이해했습니다. 우선 이 서비스에서 가장 중요한 사용자 문제를 한 문장으로 설명해 주시겠어요?`;
  }
  return `${name}${typeSuffix}에 대해, 어떤 사용자에게 어떤 문제를 해결하려는 서비스인지 한 문장으로 알려주시겠어요?`;
}

const MAX_PROMPT_TIMELINE = 50;
const BOOTSTRAP_DRAWER_SLICE = 10;

/**
 * `promptTimeline` 행·API `data.promptTrace` 등을 `RequirementsPromptTimelineEntry`로 정규화한다.
 * 필수 필드가 없으면 null(호출부에서 warn 로그 권장).
 */
export function coerceRequirementsPromptTimelineEntry(raw: unknown): RequirementsPromptTimelineEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
  const action = typeof r.action === "string" ? r.action : "";
  const stage = typeof r.stage === "string" ? r.stage : "";
  const source = typeof r.source === "string" ? r.source : "";
  if (!createdAt || !action || !stage || !source) return null;
  const selectedAgents = parsePromptTimelineSelectedAgents(r.selectedAgents);
  return {
    stage,
    action,
    source,
    createdAt,
    ...(typeof r.aiMember === "string" ? { aiMember: r.aiMember } : {}),
    ...(typeof r.stageGroup === "string" ? { stageGroup: r.stageGroup } : {}),
    ...(typeof r.workspaceScreenKey === "string" ? { workspaceScreenKey: r.workspaceScreenKey } : {}),
    ...(selectedAgents.length ? { selectedAgents } : {}),
    ...(typeof r.promptText === "string" ? { promptText: r.promptText } : {}),
    ...(typeof r.responseText === "string" ? { responseText: r.responseText } : {}),
    ...(typeof r.error === "string" ? { error: r.error } : {}),
    ...(typeof r.fallbackText === "string" ? { fallbackText: r.fallbackText } : {}),
    ...(typeof r.model === "string" || r.model === null ? { model: r.model as string | null } : {}),
    ...(typeof r.provider === "string" || r.provider === null ? { provider: r.provider as string | null } : {}),
    ...(typeof r.routingDecision === "string" ? { routingDecision: r.routingDecision } : {}),
    ...(Array.isArray(r.matchedSlots)
      ? {
          matchedSlots: r.matchedSlots.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(Array.isArray(r.updatedSlots)
      ? {
          updatedSlots: r.updatedSlots.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(typeof r.fallback === "boolean" ? { fallback: r.fallback } : {}),
    ...(typeof r.orchestratorAgent === "string" ? { orchestratorAgent: r.orchestratorAgent } : {}),
    ...(Array.isArray(r.delegatedAgents)
      ? {
          delegatedAgents: r.delegatedAgents.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(Array.isArray(r.executedAgents)
      ? {
          executedAgents: r.executedAgents.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(Array.isArray(r.staleSlots)
      ? {
          staleSlots: r.staleSlots.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(Array.isArray(r.confirmedSlots)
      ? {
          confirmedSlots: r.confirmedSlots.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(Array.isArray(r.candidateSlots)
      ? {
          candidateSlots: r.candidateSlots.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(typeof r.replyToMessageId === "string" && r.replyToMessageId.trim()
      ? { replyToMessageId: r.replyToMessageId.trim() }
      : {}),
    ...(typeof r.replyToSlotKey === "string" && r.replyToSlotKey.trim()
      ? { replyToSlotKey: r.replyToSlotKey.trim() }
      : {}),
    ...(typeof r.replyTargetSpeakerId === "string" && r.replyTargetSpeakerId.trim()
      ? { replyTargetSpeakerId: r.replyTargetSpeakerId.trim() }
      : {}),
    ...(typeof r.previousQuestion === "string" && r.previousQuestion.trim()
      ? { previousQuestion: r.previousQuestion.trim() }
      : {}),
    ...(typeof r.userAnswer === "string" && r.userAnswer.trim()
      ? { userAnswer: r.userAnswer.trim() }
      : {}),
    ...(typeof r.currentSlotKey === "string" && r.currentSlotKey.trim()
      ? { currentSlotKey: r.currentSlotKey.trim() }
      : {}),
    ...(typeof r.slotAdvanceDecision === "string" && r.slotAdvanceDecision.trim()
      ? { slotAdvanceDecision: r.slotAdvanceDecision.trim() }
      : {}),
    ...(typeof r.shouldAskFollowUp === "boolean" ? { shouldAskFollowUp: r.shouldAskFollowUp } : {}),
    ...(typeof r.followUpReason === "string" && r.followUpReason.trim()
      ? { followUpReason: r.followUpReason.trim() }
      : {}),
    ...(typeof r.nextQuestionSlotKey === "string" && r.nextQuestionSlotKey.trim()
      ? { nextQuestionSlotKey: r.nextQuestionSlotKey.trim() }
      : {}),
    ...(typeof r.slotDependenciesChanged === "boolean" ? { slotDependenciesChanged: r.slotDependenciesChanged } : {}),
    ...(typeof r.interviewQuestion === "string" && r.interviewQuestion.trim()
      ? { interviewQuestion: r.interviewQuestion.trim() }
      : {}),
    ...(Array.isArray(r.interviewSuggestions)
      ? {
          interviewSuggestions: r.interviewSuggestions.map((x) => String(x ?? "").trim()).filter(Boolean),
        }
      : {}),
    ...(r.interviewSuggestionsSource === "llm" ||
    r.interviewSuggestionsSource === "empty" ||
    r.interviewSuggestionsSource === "none"
      ? { interviewSuggestionsSource: r.interviewSuggestionsSource }
      : {}),
    ...(Array.isArray(r.suggestedDynamicSlots)
      ? { suggestedDynamicSlots: r.suggestedDynamicSlots.map((x) => String(x ?? "").trim()).filter(Boolean) }
      : {}),
    ...(Array.isArray(r.acceptedDynamicSlots)
      ? { acceptedDynamicSlots: r.acceptedDynamicSlots.map((x) => String(x ?? "").trim()).filter(Boolean) }
      : {}),
    ...(Array.isArray(r.rejectedDynamicSlots)
      ? {
          rejectedDynamicSlots: r.rejectedDynamicSlots
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const o = x as Record<string, unknown>;
              const slotKey = String(o.slotKey ?? "").trim();
              const reason = String(o.reason ?? "").trim();
              if (!slotKey || !reason) return null;
              return { slotKey, reason };
            })
            .filter(Boolean) as Array<{ slotKey: string; reason: string }>,
        }
      : {}),
  };
}

function parsePromptTimelineSelectedAgents(raw: unknown): readonly RequirementsPromptTimelineAgentRef[] {
  if (!Array.isArray(raw)) return [];
  const out: RequirementsPromptTimelineAgentRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const displayName = typeof a.displayName === "string" ? a.displayName : "";
    if (!displayName.trim()) continue;
    out.push({
      ...(typeof a.source === "string" ? { source: a.source } : {}),
      ...(typeof a.catalogKey === "string" ? { catalogKey: a.catalogKey } : {}),
      displayName,
      ...(typeof a.aiOrchestrationRole === "string" || a.aiOrchestrationRole === null
        ? { aiOrchestrationRole: a.aiOrchestrationRole as string | null }
        : {}),
      ...(typeof a.orchestrationStage === "string" || a.orchestrationStage === null
        ? { orchestrationStage: a.orchestrationStage as string | null }
        : {}),
      ...(typeof a.aiProvider === "string" || a.aiProvider === null ? { aiProvider: a.aiProvider as string | null } : {}),
      ...(typeof a.aiAgentKey === "string" || a.aiAgentKey === null ? { aiAgentKey: a.aiAgentKey as string | null } : {}),
      ...(typeof a.aiModelOverride === "string" || a.aiModelOverride === null
        ? { aiModelOverride: a.aiModelOverride as string | null }
        : {}),
      ...(typeof a.enginePreference === "string" || a.enginePreference === null
        ? { enginePreference: a.enginePreference as string | null }
        : {}),
    });
  }
  return out;
}

export function selectedAgentsForTimeline(
  agents: readonly SingleChatSelectedAgentWire[]
): readonly RequirementsPromptTimelineAgentRef[] {
  return agents.map((a) => ({
    source: a.source,
    ...(a.catalogKey ? { catalogKey: a.catalogKey } : {}),
    displayName: a.displayName,
    ...(a.aiOrchestrationRole !== undefined ? { aiOrchestrationRole: a.aiOrchestrationRole } : {}),
    ...(a.orchestrationStage !== undefined ? { orchestrationStage: a.orchestrationStage } : {}),
    ...(a.aiProvider !== undefined ? { aiProvider: a.aiProvider } : {}),
    ...(a.aiAgentKey !== undefined ? { aiAgentKey: a.aiAgentKey } : {}),
    ...(a.aiModelOverride !== undefined ? { aiModelOverride: a.aiModelOverride } : {}),
    ...(a.enginePreference !== undefined ? { enginePreference: a.enginePreference } : {}),
  }));
}

export function buildSingleChatPromptTimelineEntry(params: {
  readonly action: string;
  readonly source: "llm" | "fallback";
  readonly timelineStage: string;
  readonly stageGroup: string;
  readonly workspaceScreenKey: string;
  readonly selectedAgents: readonly SingleChatSelectedAgentWire[];
  readonly promptText?: string;
  readonly responseText?: string;
  readonly error?: string;
  readonly fallbackText?: string;
  readonly model?: string | null;
  readonly provider?: string | null;
  readonly createdAtIso?: string;
  readonly routingDecision?: string;
  readonly matchedSlots?: readonly string[];
  readonly updatedSlots?: readonly string[];
  readonly fallback?: boolean;
  readonly orchestratorAgent?: string;
  readonly delegatedAgents?: readonly string[];
  readonly executedAgents?: readonly string[];
  readonly staleSlots?: readonly string[];
  readonly confirmedSlots?: readonly string[];
  readonly candidateSlots?: readonly string[];
  readonly slotDependenciesChanged?: boolean;
  readonly interviewQuestion?: string;
  readonly interviewSuggestions?: readonly string[];
  readonly interviewSuggestionsSource?: "llm" | "empty" | "none";
  readonly replyToMessageId?: string;
  readonly replyToSlotKey?: string;
  readonly replyTargetSpeakerId?: string;
  readonly previousQuestion?: string;
  readonly userAnswer?: string;
  readonly currentSlotKey?: string;
  readonly slotAdvanceDecision?: string;
  readonly shouldAskFollowUp?: boolean;
  readonly followUpReason?: string;
  readonly nextQuestionSlotKey?: string;
  readonly suggestedDynamicSlots?: readonly string[];
  readonly acceptedDynamicSlots?: readonly string[];
  readonly rejectedDynamicSlots?: Array<{ slotKey: string; reason: string }>;
}): RequirementsPromptTimelineEntry {
  const agents = selectedAgentsForTimeline(params.selectedAgents);
  return {
    stage: params.timelineStage,
    stageGroup: params.stageGroup,
    workspaceScreenKey: params.workspaceScreenKey,
    ...(agents.length ? { selectedAgents: agents } : {}),
    action: params.action,
    source: params.source,
    createdAt: params.createdAtIso ?? new Date().toISOString(),
    ...(params.promptText ? { promptText: params.promptText } : {}),
    ...(params.responseText ? { responseText: params.responseText } : {}),
    ...(params.error ? { error: params.error } : {}),
    ...(params.fallbackText ? { fallbackText: params.fallbackText } : {}),
    ...(params.model !== undefined ? { model: params.model } : {}),
    ...(params.provider !== undefined ? { provider: params.provider } : {}),
    ...(params.routingDecision ? { routingDecision: params.routingDecision } : {}),
    ...(params.matchedSlots?.length ? { matchedSlots: [...params.matchedSlots] } : {}),
    ...(params.updatedSlots?.length ? { updatedSlots: [...params.updatedSlots] } : {}),
    ...(params.fallback !== undefined ? { fallback: params.fallback } : {}),
    ...(params.orchestratorAgent ? { orchestratorAgent: params.orchestratorAgent } : {}),
    ...(params.delegatedAgents?.length ? { delegatedAgents: [...params.delegatedAgents] } : {}),
    ...(params.executedAgents?.length ? { executedAgents: [...params.executedAgents] } : {}),
    ...(params.staleSlots?.length ? { staleSlots: [...params.staleSlots] } : {}),
    ...(params.confirmedSlots?.length ? { confirmedSlots: [...params.confirmedSlots] } : {}),
    ...(params.candidateSlots?.length ? { candidateSlots: [...params.candidateSlots] } : {}),
    ...(params.slotDependenciesChanged !== undefined ? { slotDependenciesChanged: params.slotDependenciesChanged } : {}),
    ...(params.interviewQuestion ? { interviewQuestion: params.interviewQuestion } : {}),
    ...(params.interviewSuggestions?.length ? { interviewSuggestions: [...params.interviewSuggestions] } : {}),
    ...(params.interviewSuggestionsSource ? { interviewSuggestionsSource: params.interviewSuggestionsSource } : {}),
    ...(params.replyToMessageId ? { replyToMessageId: params.replyToMessageId } : {}),
    ...(params.replyToSlotKey ? { replyToSlotKey: params.replyToSlotKey } : {}),
    ...(params.replyTargetSpeakerId ? { replyTargetSpeakerId: params.replyTargetSpeakerId } : {}),
    ...(params.previousQuestion ? { previousQuestion: params.previousQuestion } : {}),
    ...(params.userAnswer ? { userAnswer: params.userAnswer } : {}),
    ...(params.currentSlotKey ? { currentSlotKey: params.currentSlotKey } : {}),
    ...(params.slotAdvanceDecision ? { slotAdvanceDecision: params.slotAdvanceDecision } : {}),
    ...(typeof params.shouldAskFollowUp === "boolean" ? { shouldAskFollowUp: params.shouldAskFollowUp } : {}),
    ...(params.followUpReason ? { followUpReason: params.followUpReason } : {}),
    ...(params.nextQuestionSlotKey ? { nextQuestionSlotKey: params.nextQuestionSlotKey } : {}),
    ...(params.suggestedDynamicSlots?.length ? { suggestedDynamicSlots: [...params.suggestedDynamicSlots] } : {}),
    ...(params.acceptedDynamicSlots?.length ? { acceptedDynamicSlots: [...params.acceptedDynamicSlots] } : {}),
    ...(params.rejectedDynamicSlots?.length ? { rejectedDynamicSlots: [...params.rejectedDynamicSlots] } : {}),
  };
}

/** API 부트스트랩 `promptTrace`용 별칭(`coerceRequirementsPromptTimelineEntry`와 동일) */
export const coerceBootstrapPromptTrace = coerceRequirementsPromptTimelineEntry;

export function buildIdeationBootstrapFallbackPromptTrace(params: {
  readonly error: string;
  readonly fallbackText: string;
  readonly createdAtIso?: string;
  readonly routingDecision?: string;
  readonly interviewQuestion?: string;
  readonly interviewSuggestions?: readonly string[];
  readonly interviewSuggestionsSource?: "llm" | "empty" | "none";
}): RequirementsPromptTimelineEntry {
  return {
    stage: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_STAGE,
    action: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION,
    aiMember: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_AI_MEMBER,
    source: "fallback",
    error: params.error,
    fallbackText: params.fallbackText,
    createdAt: params.createdAtIso ?? new Date().toISOString(),
    ...(params.routingDecision ? { routingDecision: params.routingDecision } : { routingDecision: "bootstrap_contextual_fallback" }),
    ...(params.interviewQuestion ? { interviewQuestion: params.interviewQuestion } : {}),
    ...(params.interviewSuggestions?.length ? { interviewSuggestions: [...params.interviewSuggestions] } : {}),
    ...(params.interviewSuggestionsSource ? { interviewSuggestionsSource: params.interviewSuggestionsSource } : {}),
  };
}

export function buildIdeationBootstrapLlmPromptTrace(params: {
  readonly responseText: string;
  readonly promptText?: string | null;
  readonly model?: string | null;
  readonly provider?: string | null;
  readonly createdAtIso?: string;
  readonly interviewQuestion?: string;
  readonly interviewSuggestions?: readonly string[];
  readonly interviewSuggestionsSource?: "llm" | "empty" | "none";
}): RequirementsPromptTimelineEntry {
  const pt = String(params.promptText ?? "").trim();
  return {
    stage: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_STAGE,
    action: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION,
    aiMember: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_AI_MEMBER,
    source: "llm",
    ...(pt ? { promptText: pt } : {}),
    responseText: params.responseText,
    ...(params.model !== undefined ? { model: params.model } : {}),
    provider: params.provider ?? "openai",
    createdAt: params.createdAtIso ?? new Date().toISOString(),
    ...(params.interviewQuestion ? { interviewQuestion: params.interviewQuestion } : {}),
    ...(params.interviewSuggestions?.length ? { interviewSuggestions: [...params.interviewSuggestions] } : {}),
    ...(params.interviewSuggestionsSource ? { interviewSuggestionsSource: params.interviewSuggestionsSource } : {}),
  };
}

export function isIdeationBootstrapTimelineEntry(
  entry: { readonly stage?: string; readonly action?: string } | null | undefined
): boolean {
  return Boolean(
    entry &&
      // Drawer should show bootstrap + orchestration traces regardless of stage naming,
      // since some server routes emit `stage: "requirements"` for bootstrap turns.
      (entry.action === IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION ||
        entry.action === "requirementsChatOrchestration")
  );
}

/** 프롬프트 서랍 등: ideation·bootstrapInterview 항목만 최근 N건(역순) */
export function pickIdeationBootstrapPromptTimelineEntries(
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  limit: number = BOOTSTRAP_DRAWER_SLICE
): RequirementsPromptTimelineEntry[] {
  const list = Array.isArray(promptTimeline) ? promptTimeline : [];
  return list.filter((x) => isIdeationBootstrapTimelineEntry(x)).slice(-limit).reverse();
}

export function appendIdeationBootstrapPromptTimeline(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entry: RequirementsPromptTimelineEntry | null | undefined
): RequirementsPromptTimelineEntry[] {
  if (!entry) return Array.isArray(existing) ? [...existing] : [];
  const base = Array.isArray(existing) ? [...existing] : [];
  return [...base, entry].slice(-MAX_PROMPT_TIMELINE);
}
