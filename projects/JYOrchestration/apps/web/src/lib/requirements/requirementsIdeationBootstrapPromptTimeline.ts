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
  const desc = input.projectDescription.trim().replace(/\s+/g, " ");
  const snippet = desc.slice(0, 220).trim();
  const anchor =
    ["회의록", "녹취", "요약", "산출물", "초안"].find((w) => snippet.includes(w)) ?? (snippet.length >= 8 ? "초안" : "초안");
  if (snippet.length >= 12) {
    const thing = anchor === "초안" ? "문서 초안" : `${anchor} 초안`;
    return `AI가 정리한 ${thing}은 작성자만 확인하면 될까요, 아니면 참석자도 함께 검토·수정할 수 있어야 할까요?`;
  }
  return "AI가 만든 초안은 누가 최종 확인하고 확정하면 좋을까요?";
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
    ...(typeof r.actualModel === "string" || r.actualModel === null ? { actualModel: r.actualModel as string | null } : {}),
    ...(typeof r.configuredModelOverride === "string" || r.configuredModelOverride === null
      ? { configuredModelOverride: r.configuredModelOverride as string | null }
      : {}),
    ...(typeof r.provider === "string" || r.provider === null ? { provider: r.provider as string | null } : {}),
    ...(typeof r.routingDecision === "string" ? { routingDecision: r.routingDecision } : {}),
    ...(typeof r.currentPhase === "number" && Number.isFinite(r.currentPhase)
      ? { currentPhase: Math.max(1, Math.min(5, Math.floor(r.currentPhase))) as 1 | 2 | 3 | 4 | 5 }
      : {}),
    ...(typeof r.nextOwnerAgent === "string" && r.nextOwnerAgent.trim()
      ? { nextOwnerAgent: r.nextOwnerAgent.trim().slice(0, 40) }
      : {}),
    ...(typeof r.conversationOwner === "string" && r.conversationOwner.trim()
      ? { conversationOwner: r.conversationOwner.trim().slice(0, 40) }
      : {}),
    ...(typeof r.questionGeneratedBy === "string" && r.questionGeneratedBy.trim()
      ? { questionGeneratedBy: r.questionGeneratedBy.trim().slice(0, 40) }
      : {}),
    ...(typeof r.ownershipReason === "string" && r.ownershipReason.trim()
      ? { ownershipReason: r.ownershipReason.trim().slice(0, 200) }
      : {}),
    ...(typeof r.decisionAxis === "string" && r.decisionAxis.trim()
      ? { decisionAxis: r.decisionAxis.trim().slice(0, 80) }
      : {}),
    ...(typeof r.mergeCoordinator === "string" && r.mergeCoordinator.trim()
      ? { mergeCoordinator: r.mergeCoordinator.trim().slice(0, 40) }
      : {}),
    ...(Array.isArray(r.specialistContributors)
      ? { specialistContributors: r.specialistContributors.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 10) }
      : {}),
    ...(Array.isArray(r.decisionAxisCandidates)
      ? {
          decisionAxisCandidates: r.decisionAxisCandidates
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const o = x as Record<string, unknown>;
              const axis = String(o.axis ?? "").trim();
              const score = Number(o.score);
              if (!axis || !Number.isFinite(score)) return null;
              return { axis: axis.slice(0, 80), score: Math.max(0, Math.min(1, Number(score.toFixed(3)))) };
            })
            .filter(Boolean)
            .slice(0, 8) as Array<{ axis: string; score: number }>,
        }
      : {}),
    ...(r.ownershipScoreBreakdown && typeof r.ownershipScoreBreakdown === "object"
      ? { ownershipScoreBreakdown: r.ownershipScoreBreakdown as any }
      : {}),
    ...(r.momentumContribution && typeof r.momentumContribution === "object"
      ? { momentumContribution: r.momentumContribution as any }
      : {}),
    ...(Array.isArray(r.conflictSignals)
      ? { conflictSignals: r.conflictSignals.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 10) }
      : {}),
    ...(Array.isArray(r.slotStateTransitions)
      ? {
          slotStateTransitions: r.slotStateTransitions
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const o = x as Record<string, unknown>;
              const slotKey = String(o.slotKey ?? "").trim();
              const from = String(o.from ?? "").trim();
              const to = String(o.to ?? "").trim();
              const reason = typeof o.reason === "string" ? o.reason.trim().slice(0, 120) : undefined;
              if (!slotKey || !from || !to) return null;
              return { slotKey: slotKey.slice(0, 160), from: from.slice(0, 24), to: to.slice(0, 24), ...(reason ? { reason } : {}) };
            })
            .filter(Boolean)
            .slice(0, 40) as any,
        }
      : {}),
    ...(typeof r.updatedSlotCount === "number" && Number.isFinite(r.updatedSlotCount)
      ? { updatedSlotCount: Math.max(0, Math.floor(r.updatedSlotCount)) }
      : {}),
    ...(typeof r.fallbackReason === "string" && r.fallbackReason.trim()
      ? { fallbackReason: r.fallbackReason.trim().slice(0, 80) }
      : {}),
    ...(typeof r.rawResponseText === "string" ? { rawResponseText: r.rawResponseText.slice(0, 4000) } : {}),
    ...(typeof r.parseError === "string" && r.parseError.trim() ? { parseError: r.parseError.trim().slice(0, 400) } : {}),
    ...(typeof r.parsedJsonPreview === "string" && r.parsedJsonPreview.trim()
      ? { parsedJsonPreview: r.parsedJsonPreview.trim().slice(0, 4000) }
      : {}),
    ...(typeof r.retryPromptText === "string" && r.retryPromptText.trim()
      ? { retryPromptText: r.retryPromptText.trim().slice(0, 4000) }
      : {}),
    ...(typeof r.retryRawResponseText === "string" ? { retryRawResponseText: r.retryRawResponseText.slice(0, 4000) } : {}),
    ...(typeof r.finalQuestionBeforeFallback === "string" && r.finalQuestionBeforeFallback.trim()
      ? { finalQuestionBeforeFallback: r.finalQuestionBeforeFallback.trim().slice(0, 600) }
      : {}),
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
    ...(typeof r.detectedDomain === "string" && r.detectedDomain.trim() ? { detectedDomain: r.detectedDomain.trim().slice(0, 120) } : {}),
    ...(Array.isArray(r.missingInformation)
      ? {
          missingInformation: r.missingInformation.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 16),
        }
      : {}),
    ...(typeof r.recommendedFocus === "string" && r.recommendedFocus.trim()
      ? { recommendedFocus: r.recommendedFocus.trim().slice(0, 200) }
      : {}),
    ...(Array.isArray(r.initialOwnershipHints)
      ? {
          initialOwnershipHints: r.initialOwnershipHints
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const o = x as Record<string, unknown>;
              const slotKey = String(o.slotKey ?? "").trim();
              const ownerAgent = String(o.ownerAgent ?? "").trim();
              if (!slotKey || !ownerAgent) return null;
              return { slotKey: slotKey.slice(0, 160), ownerAgent: ownerAgent.slice(0, 64) };
            })
            .filter((x): x is { slotKey: string; ownerAgent: string } => x !== null)
            .slice(0, 16),
        }
      : {}),
    ...(typeof r.interactionMode === "string" && r.interactionMode.trim()
      ? { interactionMode: r.interactionMode.trim().slice(0, 120) }
      : {}),
    ...(r.bootstrapPhase === 1 || r.bootstrapPhase === 2 || r.bootstrapPhase === 3 ? { bootstrapPhase: r.bootstrapPhase } : {}),
    ...(typeof r.compactCatalogMode === "boolean" ? { compactCatalogMode: r.compactCatalogMode } : {}),
    ...(r.slotExpansionPhase === 1 || r.slotExpansionPhase === 2 || r.slotExpansionPhase === 3
      ? { slotExpansionPhase: r.slotExpansionPhase }
      : {}),
    ...(typeof r.questionQualityStatus === "string" &&
    (r.questionQualityStatus === "pass" ||
      r.questionQualityStatus === "retry_passed" ||
      r.questionQualityStatus === "retry_failed_repaired")
      ? { questionQualityStatus: r.questionQualityStatus }
      : {}),
    ...(Array.isArray(r.questionQualityIssues)
      ? {
          questionQualityIssues: r.questionQualityIssues.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24),
        }
      : {}),
    ...(typeof r.questionQualityRetryCount === "number" && Number.isFinite(r.questionQualityRetryCount)
      ? { questionQualityRetryCount: Math.max(0, Math.min(3, Math.floor(r.questionQualityRetryCount))) }
      : {}),
    ...(typeof r.finalQuestionSource === "string" &&
    (r.finalQuestionSource === "llm" || r.finalQuestionSource === "llm_retry" || r.finalQuestionSource === "repaired_context")
      ? { finalQuestionSource: r.finalQuestionSource }
      : {}),
    ...(Array.isArray(r.suggestionQualityIssues)
      ? {
          suggestionQualityIssues: r.suggestionQualityIssues.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24),
        }
      : {}),
    ...(typeof r.primaryDecisionAxis === "string" && r.primaryDecisionAxis.trim()
      ? { primaryDecisionAxis: r.primaryDecisionAxis.trim().slice(0, 80) }
      : {}),
    ...(typeof r.selectedQuestionAxis === "string" && r.selectedQuestionAxis.trim()
      ? { selectedQuestionAxis: r.selectedQuestionAxis.trim().slice(0, 80) }
      : {}),
    ...(Array.isArray(r.reasoningContributors)
      ? {
          reasoningContributors: r.reasoningContributors
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
            .slice(0, 12),
        }
      : {}),
    ...(Array.isArray(r.riskSignals)
      ? {
          riskSignals: r.riskSignals
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
            .slice(0, 16),
        }
      : {}),
    ...(Array.isArray(r.suggestedSlotReasons)
      ? {
          suggestedSlotReasons: r.suggestedSlotReasons
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const o = x as Record<string, unknown>;
              const slotKey = String(o.slotKey ?? "").trim();
              const reason = String(o.reason ?? "").trim();
              if (!slotKey || !reason) return null;
              return { slotKey: slotKey.slice(0, 120), reason: reason.slice(0, 240) };
            })
            .filter(Boolean) as Array<{ slotKey: string; reason: string }>,
        }
      : {}),
    ...(typeof r.internalAxis === "string" && r.internalAxis.trim()
      ? { internalAxis: r.internalAxis.trim().slice(0, 80) }
      : {}),
    ...(typeof r.userFacingQuestionStyle === "string" && r.userFacingQuestionStyle.trim()
      ? { userFacingQuestionStyle: r.userFacingQuestionStyle.trim().slice(0, 80) }
      : {}),
    ...(typeof r.userLanguageTransformApplied === "boolean" ? { userLanguageTransformApplied: r.userLanguageTransformApplied } : {}),
    ...(typeof r.fallbackGeneratedSuggestions === "boolean" ? { fallbackGeneratedSuggestions: r.fallbackGeneratedSuggestions } : {}),
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
  readonly actualModel?: string | null;
  readonly configuredModelOverride?: string | null;
  readonly provider?: string | null;
  readonly createdAtIso?: string;
  readonly routingDecision?: string;
  readonly currentPhase?: 1 | 2 | 3 | 4 | 5;
  readonly nextOwnerAgent?: string;
  readonly conversationOwner?: string;
  readonly questionGeneratedBy?: string;
  readonly ownershipReason?: string;
  readonly decisionAxis?: string;
  readonly mergeCoordinator?: string;
  readonly specialistContributors?: readonly string[];
  readonly decisionAxisCandidates?: readonly { axis: string; score: number }[];
  readonly ownershipScoreBreakdown?: RequirementsPromptTimelineEntry["ownershipScoreBreakdown"];
  readonly momentumContribution?: RequirementsPromptTimelineEntry["momentumContribution"];
  readonly conflictSignals?: readonly string[];
  readonly slotStateTransitions?: readonly { slotKey: string; from: string; to: string; reason?: string }[];
  readonly updatedSlotCount?: number;
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
  readonly detectedDomain?: string | null;
  readonly missingInformation?: readonly string[];
  readonly recommendedFocus?: string | null;
  readonly initialOwnershipHints?: Array<{ slotKey: string; ownerAgent: string }>;
  readonly interactionMode?: string | null;
  readonly bootstrapPhase?: 1 | 2 | 3;
  readonly compactCatalogMode?: boolean;
  readonly slotExpansionPhase?: 1 | 2 | 3;
  readonly questionQualityStatus?: "pass" | "retry_passed" | "retry_failed_repaired";
  readonly questionQualityIssues?: readonly string[];
  readonly questionQualityRetryCount?: number;
  readonly finalQuestionSource?: "llm" | "llm_retry" | "repaired_context";
  readonly suggestionQualityIssues?: readonly string[];
  readonly primaryDecisionAxis?: string | null;
  readonly selectedQuestionAxis?: string | null;
  readonly reasoningContributors?: readonly string[];
  readonly riskSignals?: readonly string[];
  readonly suggestedSlotReasons?: ReadonlyArray<{ slotKey: string; reason: string }>;
  readonly internalAxis?: string | null;
  readonly userFacingQuestionStyle?: string | null;
  readonly userLanguageTransformApplied?: boolean;
  readonly fallbackReason?: string;
  readonly rawResponseText?: string;
  readonly parseError?: string;
  readonly parsedJsonPreview?: string;
  readonly retryPromptText?: string;
  readonly retryRawResponseText?: string;
  readonly finalQuestionBeforeFallback?: string;
  readonly fallbackGeneratedSuggestions?: boolean;
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
    ...(params.actualModel !== undefined ? { actualModel: params.actualModel } : {}),
    ...(params.configuredModelOverride !== undefined ? { configuredModelOverride: params.configuredModelOverride } : {}),
    ...(params.provider !== undefined ? { provider: params.provider } : {}),
    ...(params.routingDecision ? { routingDecision: params.routingDecision } : {}),
    ...(typeof params.currentPhase === "number" ? { currentPhase: params.currentPhase } : {}),
    ...(typeof params.nextOwnerAgent === "string" && params.nextOwnerAgent.trim()
      ? { nextOwnerAgent: params.nextOwnerAgent.trim().slice(0, 40) }
      : {}),
    ...(typeof params.conversationOwner === "string" && params.conversationOwner.trim()
      ? { conversationOwner: params.conversationOwner.trim().slice(0, 40) }
      : {}),
    ...(typeof params.questionGeneratedBy === "string" && params.questionGeneratedBy.trim()
      ? { questionGeneratedBy: params.questionGeneratedBy.trim().slice(0, 40) }
      : {}),
    ...(typeof params.ownershipReason === "string" && params.ownershipReason.trim()
      ? { ownershipReason: params.ownershipReason.trim().slice(0, 200) }
      : {}),
    ...(typeof params.decisionAxis === "string" && params.decisionAxis.trim()
      ? { decisionAxis: params.decisionAxis.trim().slice(0, 80) }
      : {}),
    ...(typeof params.mergeCoordinator === "string" && params.mergeCoordinator.trim()
      ? { mergeCoordinator: params.mergeCoordinator.trim().slice(0, 40) }
      : {}),
    ...(params.specialistContributors?.length
      ? { specialistContributors: [...params.specialistContributors].map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 10) }
      : {}),
    ...(params.decisionAxisCandidates?.length ? { decisionAxisCandidates: [...params.decisionAxisCandidates].slice(0, 8) } : {}),
    ...(params.ownershipScoreBreakdown ? { ownershipScoreBreakdown: params.ownershipScoreBreakdown } : {}),
    ...(params.momentumContribution ? { momentumContribution: params.momentumContribution } : {}),
    ...(params.conflictSignals?.length ? { conflictSignals: [...params.conflictSignals].slice(0, 10) } : {}),
    ...(params.slotStateTransitions?.length ? { slotStateTransitions: [...params.slotStateTransitions].slice(0, 60) } : {}),
    ...(typeof params.updatedSlotCount === "number" && Number.isFinite(params.updatedSlotCount)
      ? { updatedSlotCount: Math.max(0, Math.floor(params.updatedSlotCount)) }
      : {}),
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
    ...(params.detectedDomain ? { detectedDomain: params.detectedDomain } : {}),
    ...(params.missingInformation?.length ? { missingInformation: [...params.missingInformation] } : {}),
    ...(params.recommendedFocus ? { recommendedFocus: params.recommendedFocus } : {}),
    ...(params.initialOwnershipHints?.length ? { initialOwnershipHints: [...params.initialOwnershipHints] } : {}),
    ...(params.interactionMode ? { interactionMode: params.interactionMode } : {}),
    ...(params.bootstrapPhase !== undefined ? { bootstrapPhase: params.bootstrapPhase } : {}),
    ...(params.compactCatalogMode !== undefined ? { compactCatalogMode: params.compactCatalogMode } : {}),
    ...(params.slotExpansionPhase !== undefined ? { slotExpansionPhase: params.slotExpansionPhase } : {}),
    ...(params.questionQualityStatus ? { questionQualityStatus: params.questionQualityStatus } : {}),
    ...(params.questionQualityIssues?.length ? { questionQualityIssues: [...params.questionQualityIssues] } : {}),
    ...(params.questionQualityRetryCount !== undefined ? { questionQualityRetryCount: params.questionQualityRetryCount } : {}),
    ...(params.finalQuestionSource ? { finalQuestionSource: params.finalQuestionSource } : {}),
    ...(params.suggestionQualityIssues?.length ? { suggestionQualityIssues: [...params.suggestionQualityIssues] } : {}),
    ...(params.primaryDecisionAxis ? { primaryDecisionAxis: params.primaryDecisionAxis } : {}),
    ...(params.selectedQuestionAxis ? { selectedQuestionAxis: params.selectedQuestionAxis } : {}),
    ...(params.reasoningContributors?.length ? { reasoningContributors: [...params.reasoningContributors] } : {}),
    ...(params.riskSignals?.length ? { riskSignals: [...params.riskSignals] } : {}),
    ...(params.suggestedSlotReasons?.length ? { suggestedSlotReasons: [...params.suggestedSlotReasons] } : {}),
    ...(params.internalAxis ? { internalAxis: params.internalAxis } : {}),
    ...(params.userFacingQuestionStyle ? { userFacingQuestionStyle: params.userFacingQuestionStyle } : {}),
    ...(typeof params.userLanguageTransformApplied === "boolean"
      ? { userLanguageTransformApplied: params.userLanguageTransformApplied }
      : {}),
    ...(params.fallbackReason ? { fallbackReason: params.fallbackReason } : {}),
    ...(params.rawResponseText ? { rawResponseText: params.rawResponseText.slice(0, 4000) } : {}),
    ...(params.parseError ? { parseError: params.parseError.slice(0, 400) } : {}),
    ...(params.parsedJsonPreview ? { parsedJsonPreview: params.parsedJsonPreview.slice(0, 4000) } : {}),
    ...(params.retryPromptText ? { retryPromptText: params.retryPromptText.slice(0, 4000) } : {}),
    ...(params.retryRawResponseText ? { retryRawResponseText: params.retryRawResponseText.slice(0, 4000) } : {}),
    ...(params.finalQuestionBeforeFallback ? { finalQuestionBeforeFallback: params.finalQuestionBeforeFallback.slice(0, 600) } : {}),
    ...(typeof params.fallbackGeneratedSuggestions === "boolean"
      ? { fallbackGeneratedSuggestions: params.fallbackGeneratedSuggestions }
      : {}),
  };
}

/** API 부트스트랩 `promptTrace`용 별칭(`coerceRequirementsPromptTimelineEntry`와 동일) */
export const coerceBootstrapPromptTrace = coerceRequirementsPromptTimelineEntry;

export function buildIdeationBootstrapFallbackPromptTrace(params: {
  readonly error: string;
  readonly fallbackText: string;
  readonly fallbackReason?: string;
  readonly provider?: string | null;
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
    provider: params.provider ?? "fallback",
    error: params.error,
    fallbackText: params.fallbackText,
    createdAt: params.createdAtIso ?? new Date().toISOString(),
    ...(params.routingDecision ? { routingDecision: params.routingDecision } : { routingDecision: "bootstrap_contextual_fallback" }),
    ...(params.fallbackReason ? { fallbackReason: params.fallbackReason } : {}),
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
