/**
 * Overlay: **Orchestration Entry** — 요구사항 SingleChat·멀티에이전트 오케스트레이션의 HTTP 진입점.
 * 철학·매핑표: `docs/OVERLAY_ARCHITECTURE_CONTRACTS.md`
 */
import { buildOrchestrationOverlayPromptTraceAugments } from "@/lib/overlay/overlayPromptTraceAugment";
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  buildBootstrapOpenAiRouteHandlingExceptionResult,
  runRequirementsFacilitatorOpenAI,
  runRequirementsIdeationInterviewSeedFromProjectOpenAI,
  runRequirementsSingleChatBootstrapOpenAI,
  type OrchestrationBootstrapInitializerWire,
  type RequirementsAiResponseStyle,
} from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { isPromptTimelineDebugServer, runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { recordIdeationBootstrapOpenAi } from "@/lib/debug/promptTimelineStore";
import { runBootstrapProposalFallbackSynthesisOpenAI } from "@/lib/requirements/bootstrapProposalFallbackSynthesis";
import { hasProposalFirstStructure } from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import {
  buildIdeationBootstrapDescriptionProposalSkeleton,
  buildSingleChatPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import {
  pickConfiguredModelOverrideFromAgents,
  resolveServicePlanningOrchestrationContext,
  resolveSingleChatAgentContext,
  type SingleChatSelectedAgentWire,
} from "@/lib/requirements/singleChatAgentContext";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import {
  isWorkspaceServicePlanningScreenKey,
  parseWorkspaceScreenKey,
  type WorkspaceScreenKey,
} from "@/lib/workspace-ai/workspaceScreenKeys";
import {
  buildDynamicServicePlanningSlotDefinitions,
  cloneDynamicSlotProposalsFromPlannerRoute,
  computeSlotExpansionPhaseFromState,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  SINGLE_CHAT_SERVICE_PLANNING_GROUP,
  stringifyCompactBootstrapSlotCatalogForLlm,
  validateDynamicProposedSlots,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatDynamicSlotProposalWireV1,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import { classifyProposalDecision, type ProposalDecision } from "@/lib/requirements/singleChatQuickAction";
import { resolveImplementationCandidateGapKeys } from "@/lib/requirements/implementationCandidateLabels";
import {
  IMPLEMENTATION_CANDIDATE_REFINE_RESULT_INTERNAL_TYPE,
  mergeImplementationCandidateRefineRequest,
  type ImplementationCandidateRefineRequestWire,
} from "@/lib/requirements/implementationCandidateRefineRequest";
import { runImplementationCandidateRefineTurn } from "@/lib/requirements/implementationCandidateRefineResult";
import type { ImplementationSeedGapKey } from "@/lib/requirements/implementationSeed";
import { repairUiInstructionContaminatedOrchestrationSlots } from "@/lib/requirements/uiInstructionLikePlanningValue";
import {
  activeOrchestrationRolesFromAgents,
  plannerPreferredFromAgents,
  runSelectiveMultiAgentOrchestrationOpenAI,
  runSingleChatOrchestrationFallbackTurn,
} from "@/lib/requirements/singleChatOrchestrationOpenAI";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  projectType?: string;
  stage?: string;
  userMessage?: string;
  dialogueExcerpt?: string;
  aiResponseStyle?: string;
  targets?: Array<{ id?: string; name?: string }>;
  sender?: { id?: string; name?: string };
  replyTo?: string | null;
  bootstrapInterview?: boolean;
  priorScreenHandoff?: string;
  serviceDesignStage?: string;
  mentionedAI?: string | null;
  workspaceScreenKey?: string;
  /** 클라이언트 저장 오케스트레이션 스냅샷 */
  singleChatOrchestrationV1?: unknown;
  /** 대화 요약 전용(슬롯/오케스트레이션 업데이트 없이 요약만 생성) */
  summaryOnly?: boolean;
  /** 서비스 기획 SingleChat QuickAction 칩(추천안 적용 등) */
  quickActionLabel?: string;
  /** proposal 승인 신호 — 일반 user message 와 구분 */
  proposalDecision?: string;
  /** 기획정보 후보 보완 검토 요청(드로어 선택 메타) */
  implementationCandidateRefineRequest?: {
    mode?: "all" | "selected";
    keys?: string[];
    labels?: string[];
    requestedAt?: string;
  };
};

function parseAiResponseStyle(raw: unknown): RequirementsAiResponseStyle | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "brief" || s === "detailed" || s === "standard") return s;
  return undefined;
}

function parseWorkspaceScreenForBody(raw: unknown): WorkspaceScreenKey {
  const p = parseWorkspaceScreenKey(raw);
  return p ?? "requirements_ideation";
}

const ALL_ORCH_ROLES = new Set([
  "planner",
  "service-designer",
  "domain-expert",
  "solution-architect",
  "task-reviewer",
  "ui-designer",
  "security-reviewer",
]);

function detectExplicitSpecialistMention(userMessage: string): { owner: string; reason: string } | null {
  const s = String(userMessage ?? "").trim().toLowerCase();
  if (!s) return null;
  const has = (re: RegExp) => re.test(s);
  // Match user natural language role call-outs (Korean) and common English tokens.
  if (has(/(디자이너|ui|ux)/i)) return { owner: "designer", reason: "explicit_role_mention(ui-designer)" };
  if (has(/(설계자|아키텍트|개발자\s*관점|architect)/i)) return { owner: "architect", reason: "explicit_role_mention(solution-architect)" };
  if (has(/(분석가|도메인\s*전문가|service\s*designer|domain\s*expert|analyst)/i))
    return { owner: "analyst", reason: "explicit_role_mention(service-designer)" };
  if (has(/(보안|개인정보|security)/i)) return { owner: "security", reason: "explicit_role_mention(security-reviewer)" };
  if (has(/(리뷰어|검토|reviewer)/i)) return { owner: "reviewer", reason: "explicit_role_mention(task-reviewer)" };
  return null;
}

function effectiveOrchestrationRoles(agents: readonly SingleChatSelectedAgentWire[]): Set<string> {
  const raw = activeOrchestrationRolesFromAgents(agents);
  return raw.size ? raw : ALL_ORCH_ROLES;
}

function ensureOrchestrationBaseState(params: {
  readonly raw: unknown;
  readonly definitions: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>;
  readonly nowIso: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  const parsed = parseRequirementsSingleChatOrchestrationV1(params.raw, params.definitions);
  if (parsed && parsed.slotDefinitionsHash === hashSlotDefinitions(params.definitions)) {
    return parsed;
  }
  return initialOrchestrationStateFromDefinitions(params.definitions, params.nowIso);
}

function initialOrchestrationPayload(
  projectName: string,
  projectDescription: string,
  projectType: string | null,
  nowIso: string,
  servicePlanningCatalogKeys: readonly WorkspaceAiMemberId[] | null
) {
  const defs = buildDynamicServicePlanningSlotDefinitions({
    projectName,
    projectDescription,
    projectType,
    servicePlanningAgentCatalogKeys: servicePlanningCatalogKeys ?? [],
  });
  return initialOrchestrationStateFromDefinitions(defs, nowIso);
}

function shouldLogBootstrapRouteResult(): boolean {
  return process.env.NODE_ENV !== "production" || String(process.env.JY_BOOTSTRAP_SERVER_LOG ?? "").trim() === "1";
}

/**
 * 요구사항 협의실: 아이디어 구체화 전담 AI 응답(OpenAI). projectId가 있으면 프로젝트 조회 권한 필요.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const body = (await request.json()) as Body;
    const bootstrapInterview = Boolean(body.bootstrapInterview);
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "");
    const projectTypeRaw = String(body.projectType ?? "").trim();
    const projectType = projectTypeRaw ? projectTypeRaw : null;

    const contextualBootstrapFallbackQuestion = (): string =>
      buildIdeationBootstrapDescriptionProposalSkeleton({
        projectName,
        projectDescription,
      });
    const bootstrapFallbackUserReply = (failed: { responseText?: string }): string => {
      const responseText = String(failed.responseText ?? "").trim();
      if (responseText && hasProposalFirstStructure(responseText)) return responseText;
      return contextualBootstrapFallbackQuestion();
    };
    const stageRaw = String(body.stage ?? "requirements").trim().toLowerCase();
    const userMessage = String(body.userMessage ?? "").trim();
    const quickActionLabel = typeof body.quickActionLabel === "string" ? String(body.quickActionLabel).trim() : "";
    const proposalDecisionRaw = String(body.proposalDecision ?? "").trim().toUpperCase();
    const PROPOSAL_DECISIONS = new Set<ProposalDecision>([
      "APPLY",
      "PARTIAL_EDIT",
      "ALTERNATIVE",
      "DIRECT_INPUT",
      "HOLD",
      "REVIEW_FLOW",
    ]);
    const proposalDecision: ProposalDecision | null = PROPOSAL_DECISIONS.has(proposalDecisionRaw as ProposalDecision)
      ? (proposalDecisionRaw as ProposalDecision)
      : classifyProposalDecision(quickActionLabel);
    const dialogueExcerpt = String(body.dialogueExcerpt ?? "");
    const priorScreenHandoff = String(body.priorScreenHandoff ?? "").trim();
    const responseStyle = parseAiResponseStyle(body.aiResponseStyle);
    const targetsRaw = Array.isArray(body.targets) ? body.targets : [];
    const mentionTargetsSummary = targetsRaw
      .map((t) => {
        const id = String(t?.id ?? "").trim();
        const name = String(t?.name ?? "").trim();
        if (!id && !name) return "";
        return name ? `- ${name}${id ? ` (${id})` : ""}` : `- ${id}`;
      })
      .filter(Boolean)
      .join("\n");
    const sender = body.sender && typeof body.sender === "object" ? body.sender : null;
    const senderSummary =
      sender && (String(sender.name ?? "").trim() || String(sender.id ?? "").trim())
        ? `${String(sender.name ?? "").trim() || "발신"}${String(sender.id ?? "").trim() ? ` · ${String(sender.id).trim()}` : ""}`
        : "";

    if (!bootstrapInterview && !userMessage && body.summaryOnly !== true) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    if (bootstrapInterview && !projectId) {
      return NextResponse.json(
        { success: false, message: "인터뷰 자동 시작에는 projectId가 필요합니다." },
        { status: 400 }
      );
    }

    if (projectId) {
      try {
        await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/ai-facilitator");
      } catch (error) {
        const denied = rbacErrorResponse(error);
        if (denied) {
          return denied;
        }
        throw error;
      }
    }

    const workspaceScreenForBootstrap = parseWorkspaceScreenForBody(body.workspaceScreenKey);
    const workspaceScreenForChat = bootstrapInterview ? workspaceScreenForBootstrap : parseWorkspaceScreenForBody(body.workspaceScreenKey);

    const nowIsoInit = new Date().toISOString();
    const orchPlanningCtx = projectId ? await resolveServicePlanningOrchestrationContext(projectId) : null;
    const servicePlanningCatalogKeys: WorkspaceAiMemberId[] | null = orchPlanningCtx
      ? orchPlanningCtx.selectedAgents
          .map((a) => (a.source === "catalog" ? a.catalogKey : undefined))
          .filter((x): x is WorkspaceAiMemberId => Boolean(String(x ?? "").trim()))
      : null;
    const orchInitialForBootstrap =
      projectId && bootstrapInterview
        ? initialOrchestrationPayload(projectName, projectDescription, projectType, nowIsoInit, servicePlanningCatalogKeys)
        : null;

    const agentCtxBootstrap =
      projectId && orchPlanningCtx
        ? orchPlanningCtx
        : await resolveSingleChatAgentContext(projectId, workspaceScreenForBootstrap);

    const agentCtxChat = bootstrapInterview
      ? agentCtxBootstrap
      : await resolveSingleChatAgentContext(projectId, workspaceScreenForChat);

    const explicitSpecialist = detectExplicitSpecialistMention(userMessage);

    /** 상세 정책은 `runRequirementsSingleChatBootstrapOpenAI` 시스템 프롬프트에 통합(중복 방지). */
    const orchestrationBootstrapInstructions = "";

    const stage = stageRaw === "requirements" ? "requirements" : "requirements";

    if (!bootstrapInterview && body.summaryOnly === true) {
      const summaryPrompt = `아래 대화 내용을 읽고, 서비스 기획 관점에서 핵심만 간단히 요약해 주세요.\n\n규칙:\n- 한국어\n- 6~10줄\n- 결정된 내용 / 미결정(추가 질문 필요) / 다음 단계 제안 3섹션\n- 과장/추측 금지\n\n[대화]\n${dialogueExcerpt || "(대화 없음)"}`;
      const sum = await runRequirementsFacilitatorOpenAI({
        projectName,
        projectDescription,
        stage,
        userMessage: summaryPrompt,
        dialogueExcerpt: dialogueExcerpt || "",
        responseStyle: "brief",
        priorScreenHandoff: priorScreenHandoff || undefined,
        participatingAgentsPromptBlock: agentCtxChat.promptBlock,
      });
      if (!sum.ok) {
        return NextResponse.json({ success: false, code: sum.code, message: sum.message }, { status: 502 });
      }
      const replyTrim = String(sum.text ?? "").trim();
      const trace = buildSingleChatPromptTimelineEntry({
        action: "requirementsChatSummary",
        source: "llm",
        timelineStage: agentCtxChat.timelineStage,
        stageGroup: agentCtxChat.stageGroup,
        workspaceScreenKey: agentCtxChat.workspaceScreenKey,
        selectedAgents: agentCtxChat.selectedAgents,
        promptText: sum.promptText,
        responseText: replyTrim,
        model: sum.model,
        provider: sum.provider ?? "openai",
        createdAtIso: sum.calledAt ?? new Date().toISOString(),
        routingDecision: "conversation_summary",
        orchestratorAgent: "summarizer",
      });
      return NextResponse.json({
        success: true,
        data: {
          reply: replyTrim,
          promptTrace: trace,
        },
      });
    }

    const useIdeationOrchestration =
      Boolean(projectId) &&
      !bootstrapInterview &&
      workspaceScreenForChat === "requirements_ideation" &&
      isWorkspaceServicePlanningScreenKey(workspaceScreenForChat);

    // Force orchestration wake-up when user explicitly calls a specialist, even right after bootstrap/reset.
    // This bypasses unstable hydration timing (orchPlanningCtx may be null momentarily).
    const forceWakeup = Boolean(projectId) && !bootstrapInterview && isWorkspaceServicePlanningScreenKey(workspaceScreenForChat) && Boolean(explicitSpecialist);
    const orchCtxForTurn = orchPlanningCtx ?? (forceWakeup ? await resolveSingleChatAgentContext(projectId, workspaceScreenForChat) : null);
    const orchestrationLazyInit = Boolean(forceWakeup && !orchPlanningCtx);
    const orchestrationWakeupReason = explicitSpecialist?.reason ?? null;

    if ((useIdeationOrchestration || forceWakeup) && orchCtxForTurn) {
      const defs = buildDynamicServicePlanningSlotDefinitions({
        projectName,
        projectDescription,
        projectType,
        servicePlanningAgentCatalogKeys:
          (servicePlanningCatalogKeys ??
            orchCtxForTurn.selectedAgents
              .map((a) => (a.source === "catalog" ? a.catalogKey : undefined))
              .filter((x): x is WorkspaceAiMemberId => Boolean(String(x ?? "").trim()))) as WorkspaceAiMemberId[],
      });
      const nowIso = new Date().toISOString();
      let baseState = ensureOrchestrationBaseState({
        raw: body.singleChatOrchestrationV1,
        definitions: defs,
        nowIso,
      });
      baseState = repairUiInstructionContaminatedOrchestrationSlots({
        state: baseState,
        definitions: defs,
        nowIso,
      });
      const orchestrationSlotExpansionPhase = computeSlotExpansionPhaseFromState(baseState, defs);
      const effectiveRoles = effectiveOrchestrationRoles(orchCtxForTurn.selectedAgents);

      const fallbackCandidateKeys = resolveImplementationCandidateGapKeys({
        orchestration: baseState,
        definitions: defs,
        autoCandidateGenerated: true,
      });
      const refineWireRaw = body.implementationCandidateRefineRequest;
      const refineWire: ImplementationCandidateRefineRequestWire | null = refineWireRaw?.mode
        ? {
            mode: refineWireRaw.mode,
            keys: (refineWireRaw.keys ?? []).map((k) => String(k).trim()).filter(Boolean) as ImplementationSeedGapKey[],
            labels: (refineWireRaw.labels ?? []).map((l) => String(l).trim()).filter(Boolean),
            requestedAt: String(refineWireRaw.requestedAt ?? nowIso),
          }
        : null;
      const refineRequest = mergeImplementationCandidateRefineRequest({
        wire: refineWire,
        userMessage,
        fallbackKeys: fallbackCandidateKeys,
      });

      if (refineRequest) {
        const refineTurn = runImplementationCandidateRefineTurn({
          mode: refineRequest.mode,
          keys: refineRequest.keys.length ? refineRequest.keys : fallbackCandidateKeys,
          orchestration: baseState,
          definitions: defs,
          nowIso,
          autoCandidateGenerated: true,
        });
        const needsConfirmationKeys = refineTurn.items
          .filter((i) => i.nextActionLabel === "추가 확인")
          .map((i) => i.key);
        const facilitatorPromptTrace = buildSingleChatPromptTimelineEntry({
          action: "implementation_candidate_refine_review",
          source: "internal",
          timelineStage: orchCtxForTurn.timelineStage,
          stageGroup: orchCtxForTurn.stageGroup,
          workspaceScreenKey: orchCtxForTurn.workspaceScreenKey,
          selectedAgents: orchCtxForTurn.selectedAgents,
          responseText: refineTurn.assistantMessage.slice(0, 800),
          routingDecision: `implementation_candidate_refine_${refineRequest.mode}`,
          createdAtIso: nowIso,
        });
        return NextResponse.json({
          success: true,
          data: {
            reply: refineTurn.assistantMessage,
            interviewSuggestions: [...refineTurn.interviewSuggestions],
            singleChatOrchestrationV1: refineTurn.nextState,
            promptTrace: facilitatorPromptTrace,
            messageMeta: {
              internalType: IMPLEMENTATION_CANDIDATE_REFINE_RESULT_INTERNAL_TYPE,
              implementationCandidateRefineResult: {
                mode: refineRequest.mode,
                keys: [...refineTurn.resolvedKeys],
                summary: refineTurn.summary,
                needsConfirmationKeys,
              },
            },
          },
        });
      }

      const orchTry = await runSelectiveMultiAgentOrchestrationOpenAI({
        projectName,
        projectDescription,
        projectType,
        userMessage,
        dialogueExcerpt,
        definitions: defs,
        baseState,
        participatingAgentsPromptBlock: orchCtxForTurn.promptBlock,
        activeRoles: effectiveRoles,
        mentionTargetsSummary: mentionTargetsSummary || undefined,
        senderSummary: senderSummary || undefined,
        priorScreenHandoff: priorScreenHandoff || undefined,
        orchestrationWakeupReason: orchestrationWakeupReason || undefined,
        orchestrationLazyInit,
        ...(quickActionLabel ? { quickActionLabel } : {}),
        ...(proposalDecision ? { proposalDecision } : {}),
      });

      let usedFallback = false;
      const turnOk =
        orchTry.ok === true
          ? orchTry
          : (() => {
              usedFallback = true;
              return runSingleChatOrchestrationFallbackTurn({
                userMessage,
                definitions: defs,
                baseState,
                activeRoles: effectiveRoles,
                nowIso: new Date().toISOString(),
                ...(quickActionLabel ? { quickActionLabel } : {}),
                ...(proposalDecision ? { proposalDecision } : {}),
              });
            })();

      const replyTrim = String(turnOk.assistantMessage ?? "").trim();
      const overlayAugments = buildOrchestrationOverlayPromptTraceAugments({
        workspaceScreenKey: orchCtxForTurn.workspaceScreenKey,
        timelineStage: orchCtxForTurn.timelineStage,
        meta: turnOk.meta,
        projectId: projectId ?? null,
        promptText: turnOk.promptText,
        timelineMessages: [userMessage, dialogueExcerpt, replyTrim],
      });
      const facilitatorPromptTrace = buildSingleChatPromptTimelineEntry({
        action: "requirementsChatOrchestration",
        source: usedFallback ? "fallback" : "llm",
        timelineStage: orchCtxForTurn.timelineStage,
        stageGroup: orchCtxForTurn.stageGroup,
        workspaceScreenKey: orchCtxForTurn.workspaceScreenKey,
        selectedAgents: orchCtxForTurn.selectedAgents,
        promptText: turnOk.promptText,
        responseText: replyTrim,
        model: turnOk.model,
        provider: turnOk.provider,
        routingDecision: turnOk.meta.routingDecision,
        matchedSlots: [...turnOk.meta.matchedSlots],
        updatedSlots: [...turnOk.meta.updatedSlotKeys],
        ...(typeof (turnOk.meta as any).updatedSlotCount === "number" ? { updatedSlotCount: (turnOk.meta as any).updatedSlotCount } : {}),
        ...(typeof (turnOk.meta as any).currentPhase === "number" ? { currentPhase: (turnOk.meta as any).currentPhase } : {}),
        ...(typeof (turnOk.meta as any).nextQuestionOwnerAgent === "string"
          ? { nextOwnerAgent: (turnOk.meta as any).nextQuestionOwnerAgent }
          : {}),
        ...(typeof (turnOk.meta as any).conversationOwner === "string"
          ? { conversationOwner: (turnOk.meta as any).conversationOwner }
          : {}),
        ...(typeof (turnOk.meta as any).previousConversationOwner === "string"
          ? { previousConversationOwner: (turnOk.meta as any).previousConversationOwner }
          : {}),
        ...(typeof (turnOk.meta as any).activeConversationOwner === "string"
          ? { activeConversationOwner: (turnOk.meta as any).activeConversationOwner }
          : {}),
        ...(typeof (turnOk.meta as any).ownerPersistenceReason === "string"
          ? { ownerPersistenceReason: (turnOk.meta as any).ownerPersistenceReason }
          : {}),
        ...(typeof (turnOk.meta as any).stickyTurnsRemaining === "number"
          ? { stickyTurnsRemaining: (turnOk.meta as any).stickyTurnsRemaining }
          : {}),
        ...(typeof (turnOk.meta as any).questionGeneratedBy === "string"
          ? { questionGeneratedBy: (turnOk.meta as any).questionGeneratedBy }
          : {}),
        ...(typeof (turnOk.meta as any).ownershipReason === "string"
          ? { ownershipReason: (turnOk.meta as any).ownershipReason }
          : {}),
        ...(typeof (turnOk.meta as any).decisionAxis === "string"
          ? { decisionAxis: (turnOk.meta as any).decisionAxis }
          : {}),
        ...(typeof (turnOk.meta as any).previousDecisionAxis === "string"
          ? { previousDecisionAxis: (turnOk.meta as any).previousDecisionAxis }
          : {}),
        ...(typeof (turnOk.meta as any).decisionAxisSource === "string"
          ? { decisionAxisSource: (turnOk.meta as any).decisionAxisSource }
          : {}),
        ...(typeof (turnOk.meta as any).ownerAxisMismatch === "boolean"
          ? { ownerAxisMismatch: (turnOk.meta as any).ownerAxisMismatch }
          : {}),
        ...(typeof (turnOk.meta as any).mergeCoordinator === "string"
          ? { mergeCoordinator: (turnOk.meta as any).mergeCoordinator }
          : {}),
        ...(Array.isArray((turnOk.meta as any).specialistContributors)
          ? { specialistContributors: (turnOk.meta as any).specialistContributors }
          : {}),
        ...(Array.isArray((turnOk.meta as any).decisionAxisCandidates)
          ? { decisionAxisCandidates: (turnOk.meta as any).decisionAxisCandidates }
          : {}),
        ...((turnOk.meta as any).ownershipScoreBreakdown && typeof (turnOk.meta as any).ownershipScoreBreakdown === "object"
          ? { ownershipScoreBreakdown: (turnOk.meta as any).ownershipScoreBreakdown }
          : {}),
        ...((turnOk.meta as any).momentumContribution && typeof (turnOk.meta as any).momentumContribution === "object"
          ? { momentumContribution: (turnOk.meta as any).momentumContribution }
          : {}),
        ...(Array.isArray((turnOk.meta as any).conflictSignals)
          ? { conflictSignals: (turnOk.meta as any).conflictSignals }
          : {}),
        ...(Array.isArray((turnOk.meta as any).slotStateTransitions)
          ? { slotStateTransitions: (turnOk.meta as any).slotStateTransitions }
          : {}),
        ...(typeof orchestrationWakeupReason === "string" && orchestrationWakeupReason.trim()
          ? { orchestrationWakeupReason }
          : {}),
        ...(typeof orchestrationLazyInit === "boolean" ? { orchestrationLazyInit } : {}),
        ...(typeof (turnOk.meta as any).quickActionLabel === "string" && (turnOk.meta as any).quickActionLabel.trim()
          ? { quickActionLabel: String((turnOk.meta as any).quickActionLabel).trim().slice(0, 40) }
          : {}),
        ...(typeof (turnOk.meta as any).quickActionKind === "string" && (turnOk.meta as any).quickActionKind.trim()
          ? { quickActionKind: String((turnOk.meta as any).quickActionKind).trim().slice(0, 24) }
          : {}),
        fallback: usedFallback,
        orchestratorAgent: turnOk.meta.orchestratorAgent,
        delegatedAgents: [...turnOk.meta.delegatedAgents],
        executedAgents: [...turnOk.meta.executedAgents],
        staleSlots: [...turnOk.meta.staleSlots],
        confirmedSlots: [...turnOk.meta.confirmedSlots],
        candidateSlots: [...turnOk.meta.candidateSlots],
        slotDependenciesChanged: turnOk.meta.slotDependenciesChanged,
        createdAtIso: turnOk.calledAt,
        slotExpansionPhase: orchestrationSlotExpansionPhase,
        ...(turnOk.meta.suggestedDynamicSlots?.length
          ? { suggestedDynamicSlots: [...turnOk.meta.suggestedDynamicSlots] }
          : {}),
        ...(turnOk.meta.acceptedDynamicSlotKeys?.length
          ? { acceptedDynamicSlots: [...turnOk.meta.acceptedDynamicSlotKeys] }
          : {}),
        ...(turnOk.meta.rejectedDynamicSlots?.length
          ? {
              rejectedDynamicSlots: turnOk.meta.rejectedDynamicSlots.map((x) => ({
                slotKey: x.slotKey,
                reason: x.reason,
              })),
            }
          : {}),
        ...overlayAugments,
      });

      return NextResponse.json({
        success: true,
        data: {
          reply: replyTrim,
          ...(Array.isArray((turnOk.meta as any)?.interviewSuggestions) && (turnOk.meta as any).interviewSuggestions.length
            ? { interviewSuggestions: [...((turnOk.meta as any).interviewSuggestions as string[])] }
            : {}),
          singleChatOrchestrationV1: turnOk.nextState,
          promptTrace: facilitatorPromptTrace,
        },
      });
    }

    const configuredModelOverrideBoot = pickConfiguredModelOverrideFromAgents(agentCtxBootstrap.selectedAgents);

    let result:
      | Awaited<ReturnType<typeof runRequirementsFacilitatorOpenAI>>
      | Awaited<ReturnType<typeof runRequirementsSingleChatBootstrapOpenAI>>;
    if (bootstrapInterview) {
      try {
        result = await runWithPromptTimelineProject(projectId, async () => {
          const baseDefs = buildDynamicServicePlanningSlotDefinitions({
            projectName,
            projectDescription,
            projectType,
            servicePlanningAgentCatalogKeys: servicePlanningCatalogKeys ?? [],
            acceptedDynamicSlots: null,
          });
          const baseSlotCatalogJson = stringifyCompactBootstrapSlotCatalogForLlm(baseDefs);
          return runRequirementsSingleChatBootstrapOpenAI({
            projectName,
            projectDescription,
            projectType,
            participatingAgentsPromptBlock: agentCtxBootstrap.promptBlock,
            orchestrationBootstrapInstructions,
            baseSlotCatalogJson,
            diagnosticMeta: {
              projectId: projectId || null,
              configuredModelOverride: configuredModelOverrideBoot,
            },
          });
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result = buildBootstrapOpenAiRouteHandlingExceptionResult({
          errorMessage: msg,
          configuredModelOverride: configuredModelOverrideBoot,
        });
      }
    } else {
      result = await runRequirementsFacilitatorOpenAI({
        projectName,
        projectDescription,
        stage,
        userMessage,
        dialogueExcerpt,
        responseStyle,
        mentionTargetsSummary: mentionTargetsSummary || undefined,
        senderSummary: senderSummary || undefined,
        priorScreenHandoff: priorScreenHandoff || undefined,
        participatingAgentsPromptBlock: agentCtxChat.promptBlock,
      });
    }
    if (!result.ok) {
      if (bootstrapInterview) {
        const routeSynth = await runBootstrapProposalFallbackSynthesisOpenAI({
          projectName,
          projectDescription,
          projectType,
          failureIssues: [
            ...(((result as any).proposalQualityIssues as string[] | undefined) ?? []),
            ...(((result as any).questionQualityIssues as string[] | undefined) ?? []),
            String((result as any).fallbackReason ?? result.code ?? "").trim(),
          ].filter(Boolean),
          rejectedProposalPreview: String((result as any).parsedJsonPreview ?? "").slice(0, 500),
          rejectedQuestion: String((result as any).finalQuestionBeforeFallback ?? ""),
        });
        if (routeSynth.ok) {
          const orchPayloadRoute =
            orchInitialForBootstrap ??
            (projectId
              ? initialOrchestrationPayload(
                  projectName,
                  projectDescription,
                  projectType,
                  new Date().toISOString(),
                  servicePlanningCatalogKeys,
                )
              : null);
          return NextResponse.json({
            success: true,
            data: {
              reply: routeSynth.question,
              ...(orchPayloadRoute ? { singleChatOrchestrationV1: orchPayloadRoute } : {}),
              promptTrace: buildSingleChatPromptTimelineEntry({
                action: "bootstrapInterview",
                source: "llm",
                timelineStage: agentCtxBootstrap.timelineStage,
                stageGroup: agentCtxBootstrap.stageGroup,
                workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
                selectedAgents: agentCtxBootstrap.selectedAgents,
                promptText: `${String((result as any).promptText ?? "").trim()}\n\n--- bootstrap_proposal_fallback_synthesis(route) ---\n${routeSynth.promptText}`,
                responseText: routeSynth.question.slice(0, 4000),
                model: routeSynth.model,
                provider: "openai",
                createdAtIso: new Date().toISOString(),
                routingDecision: "bootstrap_proposal_fallback_synthesis",
                fallbackReason: "PROPOSAL_VALIDATION_FAILED",
                finalQuestionSource: "proposal_fallback_synthesis",
                orchestratorAgent: "planner",
                fallback: false,
                interviewQuestion: routeSynth.question,
                ...(routeSynth.suggestions.length ? { interviewSuggestions: [...routeSynth.suggestions] } : {}),
                interviewSuggestionsSource: routeSynth.suggestions.length ? ("llm" as const) : ("empty" as const),
              }),
              interviewSuggestions: routeSynth.suggestions,
              interviewAllowCustomInput: routeSynth.allowCustomInput,
            },
          });
        }
      }
      if (bootstrapInterview && shouldLogBootstrapRouteResult()) {
        console.info("[bootstrap-route-result]", {
          ok: false,
          fallbackReason: String((result as any).fallbackReason ?? "").trim() || String((result as any).code ?? "") || "UNKNOWN_BOOTSTRAP_ERROR",
          hasQuestion: false,
          source: "fallback",
          routingDecision: "bootstrap_proposal_skeleton_fallback",
        });
      }
      if (bootstrapInterview && isPromptTimelineDebugServer() && projectId) {
        recordIdeationBootstrapOpenAi({
          projectId,
          model: (result as any).model ?? null,
          ok: false,
          error: `${result.code}: ${result.message}`,
          fallbackText: contextualBootstrapFallbackQuestion(),
          promptText: (result as any).promptText,
          at: (result as any).calledAt,
        });
      }
      const orchPayload =
        orchInitialForBootstrap ??
        (projectId
          ? initialOrchestrationPayload(projectName, projectDescription, projectType, new Date().toISOString(), servicePlanningCatalogKeys)
          : null);

      const plannerChosen = Boolean(orchPlanningCtx && plannerPreferredFromAgents(orchPlanningCtx.selectedAgents));

      if (bootstrapInterview && result.code === "NO_KEY") {
        return NextResponse.json(
          {
            success: false,
            code: "NO_AI_PROVIDER",
            message: "AI 기획자 호출에 필요한 OpenAI 설정이 없습니다.",
            data: {
              ...(orchPayload ? { singleChatOrchestrationV1: orchPayload } : {}),
              promptTrace: buildSingleChatPromptTimelineEntry({
                action: "bootstrapInterview",
                source: "fallback",
                timelineStage: agentCtxBootstrap.timelineStage,
                stageGroup: agentCtxBootstrap.stageGroup,
                workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
                selectedAgents: agentCtxBootstrap.selectedAgents,
                error: "NO_AI_PROVIDER",
                fallbackText: contextualBootstrapFallbackQuestion(),
                fallback: true,
                orchestratorAgent: "planner",
                routingDecision: plannerChosen ? "bootstrap_fallback(NO_KEY)" : "bootstrap_fallback(NO_KEY)",
                fallbackReason: "NO_KEY",
                provider: "fallback",
                model: resolveOpenAiModelFromEnv(),
                actualModel: resolveOpenAiModelFromEnv(),
                configuredModelOverride: configuredModelOverrideBoot,
              }),
            },
          },
          { status: 503 }
        );
      }
      const bootstrapFailureDisplayReply = bootstrapFallbackUserReply({
        responseText: String((result as { responseText?: string }).responseText ?? ""),
      });
      return NextResponse.json({
        success: false,
        code: result.code,
        message: result.message,
        ...(bootstrapInterview
          ? {
              data: {
                reply: bootstrapFailureDisplayReply,
                ...(orchPayload ? { singleChatOrchestrationV1: orchPayload } : {}),
                promptTrace: buildSingleChatPromptTimelineEntry({
                  action: "bootstrapInterview",
                  source: "fallback",
                  timelineStage: agentCtxBootstrap.timelineStage,
                  stageGroup: agentCtxBootstrap.stageGroup,
                  workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
                  selectedAgents: agentCtxBootstrap.selectedAgents,
                  promptText: String((result as any).promptText ?? "").trim() || undefined,
                  responseText: bootstrapFailureDisplayReply,
                  model: String((result as any).model ?? "").trim() || resolveOpenAiModelFromEnv(),
                  actualModel: String((result as any).model ?? "").trim() || resolveOpenAiModelFromEnv(),
                  configuredModelOverride: configuredModelOverrideBoot,
                  provider: String((result as any).provider ?? "").trim() || "openai",
                  createdAtIso: String((result as any).calledAt ?? "").trim() || new Date().toISOString(),
                  error: `${result.code}: ${result.message}`,
                  fallbackText: bootstrapFailureDisplayReply,
                  fallback: true,
                  orchestratorAgent: "planner",
                  interviewQuestion: bootstrapFailureDisplayReply,
                  routingDecision: "bootstrap_proposal_skeleton_fallback",
                  fallbackReason: String((result as any).fallbackReason ?? "").trim() || String(result.code ?? "") || "UNKNOWN_BOOTSTRAP_ERROR",
                  rawResponseText: String((result as any).rawResponseText ?? "") || undefined,
                  parseError: String((result as any).parseError ?? "") || undefined,
                  parsedJsonPreview: String((result as any).parsedJsonPreview ?? "") || undefined,
                  retryPromptText: String((result as any).retryPromptText ?? "") || undefined,
                  retryRawResponseText: String((result as any).retryRawResponseText ?? "") || undefined,
                  finalQuestionBeforeFallback: String((result as any).finalQuestionBeforeFallback ?? "") || undefined,
                  ...(typeof (result as any).questionQualityStatus === "string"
                    ? { questionQualityStatus: (result as any).questionQualityStatus }
                    : {}),
                  ...(Array.isArray((result as any).questionQualityIssues)
                    ? { questionQualityIssues: [...(result as any).questionQualityIssues] }
                    : {}),
                  ...(typeof (result as any).questionQualityRetryCount === "number"
                    ? { questionQualityRetryCount: (result as any).questionQualityRetryCount }
                    : {}),
                  ...(typeof (result as any).finalQuestionSource === "string"
                    ? { finalQuestionSource: (result as any).finalQuestionSource }
                    : {}),
                }),
              },
            }
          : {
              data: {
                promptTrace: buildSingleChatPromptTimelineEntry({
                  action: "requirementsChat",
                  source: "fallback",
                  timelineStage: agentCtxChat.timelineStage,
                  stageGroup: agentCtxChat.stageGroup,
                  workspaceScreenKey: agentCtxChat.workspaceScreenKey,
                  selectedAgents: agentCtxChat.selectedAgents,
                  error: `${result.code}: ${result.message}`,
                  fallbackText: "",
                  fallback: true,
                  orchestratorAgent: "planner",
                  routingDecision: "facilitator_error",
                }),
              },
            }),
      });
    }
    const replyTrim =
      bootstrapInterview && result.ok
        ? String((result as any).question ?? "").trim()
        : String((result as any).text ?? "").trim();
    if (bootstrapInterview && !replyTrim) {
      if (bootstrapInterview && isPromptTimelineDebugServer() && projectId) {
        recordIdeationBootstrapOpenAi({
          projectId,
          model: result.model ?? null,
          promptText: result.promptText,
          ok: false,
          error: "EMPTY_REPLY",
          fallbackText: contextualBootstrapFallbackQuestion(),
        });
      }
      return NextResponse.json(
        {
          success: false,
          code: "EMPTY_REPLY",
          message: "bootstrapInterview 응답이 비어 있습니다.",
          data: {
            ...(orchInitialForBootstrap ? { singleChatOrchestrationV1: orchInitialForBootstrap } : {}),
            promptTrace: buildSingleChatPromptTimelineEntry({
              action: "bootstrapInterview",
              source: "fallback",
              timelineStage: agentCtxBootstrap.timelineStage,
              stageGroup: agentCtxBootstrap.stageGroup,
              workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
              selectedAgents: agentCtxBootstrap.selectedAgents,
              error: "EMPTY_REPLY",
              fallbackText: contextualBootstrapFallbackQuestion(),
              fallback: true,
              orchestratorAgent: "planner",
              routingDecision: "bootstrap_contextual_fallback_empty_reply",
              fallbackReason: "EMPTY_RESPONSE",
              model: String((result as any).model ?? "").trim() || resolveOpenAiModelFromEnv(),
              actualModel: String((result as any).model ?? "").trim() || resolveOpenAiModelFromEnv(),
              configuredModelOverride: configuredModelOverrideBoot,
            }),
          },
        },
        { status: 502 }
      );
    }

    const seed = bootstrapInterview
      ? await runRequirementsIdeationInterviewSeedFromProjectOpenAI({
          projectName,
          projectDescription,
          projectType,
        })
      : null;

    if (bootstrapInterview && isPromptTimelineDebugServer() && projectId) {
      recordIdeationBootstrapOpenAi({
        projectId,
        model: result.model ?? null,
        promptText: result.promptText,
        ok: true,
        replyText: replyTrim,
        at: result.calledAt,
      });
    }

    const plannerChosenOk = Boolean(orchPlanningCtx && plannerPreferredFromAgents(orchPlanningCtx.selectedAgents));

    // Unified bootstrap: 1 LLM call provides question + suggestions + suggestedSlots.
    let suggestedDynamicSlots: string[] = [];
    let acceptedDynamicSlots: string[] = [];
    let rejectedDynamicSlots: Array<{ slotKey: string; reason: string }> = [];
    let orchPayload = orchInitialForBootstrap;
    let bootSug: string[] | undefined;
    let bootAllowCustom = true;
    let bootstrapMeta: OrchestrationBootstrapInitializerWire | undefined = undefined;
    let slotExpansionPhaseForBootstrap: 1 | 2 | 3 = 1;

    if (bootstrapInterview && result.ok) {
      // `runRequirementsSingleChatBootstrapOpenAI`
      const r = result as any;
      bootSug = Array.isArray(r.suggestions) ? (r.suggestions as string[]) : [];
      bootAllowCustom = r.allowCustomInput !== false;
      bootstrapMeta = r.orchestrationBootstrap && typeof r.orchestrationBootstrap === "object" ? r.orchestrationBootstrap : undefined;
      const suggestedSlotsRaw = Array.isArray(r.suggestedSlots) ? r.suggestedSlots : [];
      const suggestedSnapshot = cloneDynamicSlotProposalsFromPlannerRoute(
        suggestedSlotsRaw.filter((x: unknown): x is object => Boolean(x && typeof x === "object")) as readonly SingleChatDynamicSlotProposalWireV1[]
      );
      suggestedDynamicSlots = suggestedSnapshot.map((s) => s.slotKey).filter(Boolean);

      const baseDefs = buildDynamicServicePlanningSlotDefinitions({
        projectName,
        projectDescription,
        projectType,
        servicePlanningAgentCatalogKeys: servicePlanningCatalogKeys ?? [],
        acceptedDynamicSlots: null,
      });
      const v = validateDynamicProposedSlots({
        nowIso: r.calledAt ?? new Date().toISOString(),
        baseDefinitions: baseDefs,
        existingDynamicSlots: null,
        suggestedSlots: suggestedSnapshot,
      });
      acceptedDynamicSlots = v.accepted.map((d) => d.slotKey);
      rejectedDynamicSlots = v.rejected.map((x) => ({ slotKey: x.slotKey, reason: x.reason }));

      const defsFinal = buildDynamicServicePlanningSlotDefinitions({
        projectName,
        projectDescription,
        projectType,
        servicePlanningAgentCatalogKeys: servicePlanningCatalogKeys ?? [],
        acceptedDynamicSlots: v.accepted,
      });
      const dynMap: Record<string, any> = {};
      for (const d of v.accepted) dynMap[d.slotKey] = d;
      orchPayload = initialOrchestrationStateFromDefinitions(defsFinal, r.calledAt ?? new Date().toISOString());
      orchPayload = {
        ...(orchPayload as any),
        ...(bootstrapMeta ? { bootstrapMeta: { ...bootstrapMeta } } : {}),
        dynamicSlots: dynMap,
        rejectedDynamicSlots: v.rejected,
        slotProposalHistory: [
          {
            proposedAt: r.calledAt ?? new Date().toISOString(),
            suggestedSlots: suggestedSnapshot,
            acceptedSlotKeys: v.accepted.map((d) => d.slotKey),
            rejected: v.rejected,
          },
        ],
      };
      slotExpansionPhaseForBootstrap = computeSlotExpansionPhaseFromState(
        orchPayload as RequirementsSingleChatOrchestrationStateV1,
        defsFinal
      );
    }

    const bootstrapSugSource =
      bootstrapInterview && result.ok ? (bootSug?.length ? ("llm" as const) : ("empty" as const)) : undefined;
    const bootstrapPromptTrace = buildSingleChatPromptTimelineEntry({
      action: "bootstrapInterview",
      source: "llm",
      timelineStage: agentCtxBootstrap.timelineStage,
      stageGroup: agentCtxBootstrap.stageGroup,
      workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
      selectedAgents: agentCtxBootstrap.selectedAgents,
      promptText: (result as any).promptText,
      responseText: replyTrim,
      model: (result as any).model,
      actualModel: String((result as any).actualModel ?? (result as any).model ?? "").trim() || undefined,
      configuredModelOverride: (result as any).configuredModelOverride ?? configuredModelOverrideBoot ?? undefined,
      provider: (result as any).provider ?? "openai",
      createdAtIso: (result as any).calledAt ?? new Date().toISOString(),
      routingDecision:
        bootstrapInterview && result.ok && (result as { proposalFallbackApplied?: boolean }).proposalFallbackApplied
          ? "bootstrap_proposal_fallback_synthesis"
          : plannerChosenOk
            ? "bootstrap_llm_first_question(planner)"
            : "bootstrap_llm_first_question(default)",
      orchestratorAgent: "planner",
      delegatedAgents: [],
      fallback: false,
      interviewQuestion: replyTrim,
      ...(bootSug?.length ? { interviewSuggestions: bootSug } : {}),
      ...(bootstrapSugSource ? { interviewSuggestionsSource: bootstrapSugSource } : {}),
      ...(suggestedDynamicSlots.length ? { suggestedDynamicSlots } : {}),
      ...(acceptedDynamicSlots.length ? { acceptedDynamicSlots } : {}),
      ...(rejectedDynamicSlots.length ? { rejectedDynamicSlots } : {}),
      ...(bootstrapMeta?.detectedDomain ? { detectedDomain: bootstrapMeta.detectedDomain } : {}),
      ...(bootstrapMeta?.missingInformation?.length ? { missingInformation: [...bootstrapMeta.missingInformation] } : {}),
      ...(bootstrapMeta?.recommendedFocus ? { recommendedFocus: bootstrapMeta.recommendedFocus } : {}),
      ...(bootstrapMeta?.initialOwnershipHints?.length
        ? { initialOwnershipHints: [...bootstrapMeta.initialOwnershipHints] }
        : {}),
      ...(bootstrapMeta?.interactionMode ? { interactionMode: bootstrapMeta.interactionMode } : {}),
      ...(bootstrapInterview && result.ok
        ? {
            bootstrapPhase: 1 as const,
            compactCatalogMode: true,
            slotExpansionPhase: slotExpansionPhaseForBootstrap,
          }
        : {}),
      ...(bootstrapMeta?.primaryDecisionAxis ? { primaryDecisionAxis: bootstrapMeta.primaryDecisionAxis } : {}),
      ...(bootstrapMeta?.selectedQuestionAxis ? { selectedQuestionAxis: bootstrapMeta.selectedQuestionAxis } : {}),
      ...(bootstrapMeta?.reasoningContributors?.length ? { reasoningContributors: [...bootstrapMeta.reasoningContributors] } : {}),
      ...(bootstrapMeta?.riskSignals?.length ? { riskSignals: [...bootstrapMeta.riskSignals] } : {}),
      ...(bootstrapMeta?.primaryDecisionAxis ? { internalAxis: bootstrapMeta.primaryDecisionAxis } : {}),
      ...(bootstrapMeta?.userFacingQuestionStyle ? { userFacingQuestionStyle: bootstrapMeta.userFacingQuestionStyle } : {}),
      ...(bootstrapInterview && result.ok && typeof (result as any).userLanguageTransformApplied === "boolean"
        ? { userLanguageTransformApplied: Boolean((result as any).userLanguageTransformApplied) }
        : {}),
      ...(bootstrapInterview &&
      result.ok &&
      Array.isArray((result as { suggestedSlotReasons?: readonly { slotKey: string; reason: string }[] }).suggestedSlotReasons) &&
      (result as { suggestedSlotReasons?: readonly unknown[] }).suggestedSlotReasons!.length
        ? {
            suggestedSlotReasons: [
              ...((result as { suggestedSlotReasons: readonly { slotKey: string; reason: string }[] }).suggestedSlotReasons),
            ],
          }
        : {}),
      ...(bootstrapInterview &&
      result.ok &&
      typeof (result as { questionQualityStatus?: string }).questionQualityStatus === "string"
        ? {
            questionQualityStatus: (result as { questionQualityStatus: "pass" | "retry_passed" | "retry_failed_repaired" })
              .questionQualityStatus,
            questionQualityIssues: [
              ...(((result as { questionQualityIssues?: readonly string[] }).questionQualityIssues ?? []) as string[]),
            ],
            questionQualityRetryCount: Number(
              (result as { questionQualityRetryCount?: number }).questionQualityRetryCount ?? 0
            ),
            finalQuestionSource: (result as { finalQuestionSource?: string }).finalQuestionSource as
              | "llm"
              | "llm_retry"
              | "repaired_context"
              | "proposal_synthesis"
              | "llm_proposal_regeneration"
              | "proposal_fallback_synthesis"
              | undefined,
            ...((result as { proposalFallbackApplied?: boolean }).proposalFallbackApplied
              ? {
                  proposalFallbackApplied: true,
                  fallbackReason:
                    (result as { recoveryFallbackReason?: string }).recoveryFallbackReason ?? "PROPOSAL_VALIDATION_FAILED",
                }
              : {}),
          }
        : {}),
      ...(bootstrapInterview &&
      result.ok &&
      Array.isArray((result as { suggestionQualityIssues?: readonly string[] }).suggestionQualityIssues) &&
      (result as { suggestionQualityIssues?: readonly string[] }).suggestionQualityIssues!.length
        ? {
            suggestionQualityIssues: [
              ...((result as { suggestionQualityIssues: readonly string[] }).suggestionQualityIssues as string[]),
            ],
          }
        : {}),
      ...(bootstrapInterview && result.ok && typeof (result as any).rawResponseText === "string" && String((result as any).rawResponseText).trim()
        ? { rawResponseText: String((result as any).rawResponseText).slice(0, 4000) }
        : {}),
      ...(bootstrapInterview && result.ok && typeof (result as any).retryPromptText === "string" && String((result as any).retryPromptText).trim()
        ? { retryPromptText: String((result as any).retryPromptText).slice(0, 4000) }
        : {}),
      ...(bootstrapInterview && result.ok && typeof (result as any).retryRawResponseText === "string" && String((result as any).retryRawResponseText).trim()
        ? { retryRawResponseText: String((result as any).retryRawResponseText).slice(0, 4000) }
        : {}),
      ...(bootstrapInterview &&
      result.ok &&
      typeof (result as any).finalQuestionBeforeFallback === "string" &&
      String((result as any).finalQuestionBeforeFallback).trim()
        ? { finalQuestionBeforeFallback: String((result as any).finalQuestionBeforeFallback).slice(0, 600) }
        : {}),
      ...(bootstrapInterview && result.ok && (result as any).fallbackGeneratedSuggestions === true
        ? { fallbackGeneratedSuggestions: true }
        : {}),
    });
    if (bootstrapInterview && shouldLogBootstrapRouteResult()) {
      console.info("[bootstrap-route-result]", {
        ok: Boolean(result.ok),
        fallbackReason: (result as any).fallbackReason ?? null,
        hasQuestion: Boolean(String((result as any).question ?? "").trim()),
        source: bootstrapPromptTrace.source,
        routingDecision: bootstrapPromptTrace.routingDecision,
      });
    }

    const facilitatorPromptTrace =
      !bootstrapInterview && result.ok
        ? buildSingleChatPromptTimelineEntry({
            action: "requirementsChat",
            source: "llm",
            timelineStage: agentCtxChat.timelineStage,
            stageGroup: agentCtxChat.stageGroup,
            workspaceScreenKey: agentCtxChat.workspaceScreenKey,
            selectedAgents: agentCtxChat.selectedAgents,
            promptText: result.promptText,
            responseText: replyTrim,
            model: result.model,
            provider: result.provider ?? "openai",
            createdAtIso: result.calledAt ?? new Date().toISOString(),
          })
        : null;

    const bootInterviewSug =
      bootstrapInterview && result.ok && Array.isArray((result as any).suggestions) && (result as any).suggestions.length
        ? ([...(result as any).suggestions] as string[])
        : undefined;
    return NextResponse.json({
      success: true,
      data: {
        reply: replyTrim,
        ...(bootstrapInterview
          ? {
              promptText: result.promptText ?? "",
              model: result.model,
              provider: result.provider ?? "openai",
              calledAt: result.calledAt ?? new Date().toISOString(),
              promptTrace: bootstrapPromptTrace,
              ...(orchPayload ? { singleChatOrchestrationV1: orchPayload } : {}),
              ...(bootInterviewSug?.length ? { interviewSuggestions: bootInterviewSug } : {}),
              ...(bootstrapInterview && result.ok && bootAllowCustom === false ? { interviewAllowCustomInput: false } : {}),
            }
          : {
              promptTrace: facilitatorPromptTrace,
            }),
        seedInterviewState: seed && seed.ok ? seed.wire : null,
      },
    });
  } catch (error) {
    console.error("POST /api/requirements/ai-facilitator error:", error);
    return NextResponse.json(
      { success: false, message: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
