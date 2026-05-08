import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  runRequirementsFacilitatorOpenAI,
  runRequirementsIdeationInterviewSeedFromProjectOpenAI,
  runRequirementsSingleChatBootstrapOpenAI,
  type OrchestrationBootstrapInitializerWire,
  type RequirementsAiResponseStyle,
} from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { isPromptTimelineDebugServer, runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { recordIdeationBootstrapOpenAi } from "@/lib/debug/promptTimelineStore";
import {
  buildIdeationBootstrapContextualFallbackQuestion,
  buildSingleChatPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import {
  resolveServicePlanningOrchestrationContext,
  resolveSingleChatAgentContext,
  type SingleChatSelectedAgentWire,
} from "@/lib/requirements/singleChatAgentContext";
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
      buildIdeationBootstrapContextualFallbackQuestion({
        projectName,
        projectDescription,
        projectType,
      });
    const stageRaw = String(body.stage ?? "requirements").trim().toLowerCase();
    const userMessage = String(body.userMessage ?? "").trim();
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

    if (!bootstrapInterview && !userMessage) {
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

    /** 상세 정책은 `runRequirementsSingleChatBootstrapOpenAI` 시스템 프롬프트에 통합(중복 방지). */
    const orchestrationBootstrapInstructions = "";

    const stage = stageRaw === "requirements" ? "requirements" : "requirements";

    const useIdeationOrchestration =
      Boolean(projectId) &&
      !bootstrapInterview &&
      workspaceScreenForChat === "requirements_ideation" &&
      isWorkspaceServicePlanningScreenKey(workspaceScreenForChat);

    if (useIdeationOrchestration && orchPlanningCtx) {
      const defs = buildDynamicServicePlanningSlotDefinitions({
        projectName,
        projectDescription,
        projectType,
        servicePlanningAgentCatalogKeys: (servicePlanningCatalogKeys ?? []) as WorkspaceAiMemberId[],
      });
      const nowIso = new Date().toISOString();
      const baseState = ensureOrchestrationBaseState({
        raw: body.singleChatOrchestrationV1,
        definitions: defs,
        nowIso,
      });
      const orchestrationSlotExpansionPhase = computeSlotExpansionPhaseFromState(baseState, defs);
      const effectiveRoles = effectiveOrchestrationRoles(orchPlanningCtx.selectedAgents);

      const orchTry = await runSelectiveMultiAgentOrchestrationOpenAI({
        projectName,
        projectDescription,
        projectType,
        userMessage,
        dialogueExcerpt,
        definitions: defs,
        baseState,
        participatingAgentsPromptBlock: orchPlanningCtx.promptBlock,
        activeRoles: effectiveRoles,
        mentionTargetsSummary: mentionTargetsSummary || undefined,
        senderSummary: senderSummary || undefined,
        priorScreenHandoff: priorScreenHandoff || undefined,
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
              });
            })();

      const replyTrim = String(turnOk.assistantMessage ?? "").trim();
      const facilitatorPromptTrace = buildSingleChatPromptTimelineEntry({
        action: "requirementsChatOrchestration",
        source: usedFallback ? "fallback" : "llm",
        timelineStage: orchPlanningCtx.timelineStage,
        stageGroup: orchPlanningCtx.stageGroup,
        workspaceScreenKey: orchPlanningCtx.workspaceScreenKey,
        selectedAgents: orchPlanningCtx.selectedAgents,
        promptText: turnOk.promptText,
        responseText: replyTrim,
        model: turnOk.model,
        provider: turnOk.provider,
        routingDecision: turnOk.meta.routingDecision,
        matchedSlots: [...turnOk.meta.matchedSlots],
        updatedSlots: [...turnOk.meta.updatedSlotKeys],
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
      });

      return NextResponse.json({
        success: true,
        data: {
          reply: replyTrim,
          singleChatOrchestrationV1: turnOk.nextState,
          promptTrace: facilitatorPromptTrace,
        },
      });
    }

    const result = bootstrapInterview
      ? await runWithPromptTimelineProject(projectId, async () => {
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
          });
        })
      : await runRequirementsFacilitatorOpenAI({
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
    if (!result.ok) {
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
              }),
            },
          },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: false,
        code: result.code,
        message: result.message,
        ...(bootstrapInterview
          ? {
              data: {
                ...(orchPayload ? { singleChatOrchestrationV1: orchPayload } : {}),
                promptTrace: buildSingleChatPromptTimelineEntry({
                  action: "bootstrapInterview",
                  source: "fallback",
                  timelineStage: agentCtxBootstrap.timelineStage,
                  stageGroup: agentCtxBootstrap.stageGroup,
                  workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
                  selectedAgents: agentCtxBootstrap.selectedAgents,
                  promptText: String((result as any).promptText ?? "").trim() || undefined,
                  responseText: String((result as any).responseText ?? "").trim() || undefined,
                  model: String((result as any).model ?? "").trim() || undefined,
                  provider: String((result as any).provider ?? "").trim() || "openai",
                  createdAtIso: String((result as any).calledAt ?? "").trim() || new Date().toISOString(),
                  error: `${result.code}: ${result.message}`,
                  fallbackText: contextualBootstrapFallbackQuestion(),
                  fallback: true,
                  orchestratorAgent: "planner",
                  routingDecision: "bootstrap_contextual_fallback",
                  fallbackReason: String((result as any).fallbackReason ?? "") || String(result.code ?? "") || "UNKNOWN_BOOTSTRAP_ERROR",
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
        suggestedSlotsRaw.filter((x) => x && typeof x === "object") as readonly SingleChatDynamicSlotProposalWireV1[]
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
    const usedRepair = bootstrapInterview && result.ok && (result as any).finalQuestionSource === "repaired_context";
    const bootstrapPromptTrace = buildSingleChatPromptTimelineEntry({
      action: "bootstrapInterview",
      source: usedRepair ? "fallback" : "llm",
      timelineStage: agentCtxBootstrap.timelineStage,
      stageGroup: agentCtxBootstrap.stageGroup,
      workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
      selectedAgents: agentCtxBootstrap.selectedAgents,
      promptText: (result as any).promptText,
      responseText: replyTrim,
      model: (result as any).model,
      provider: (result as any).provider ?? "openai",
      createdAtIso: (result as any).calledAt ?? new Date().toISOString(),
      routingDecision: plannerChosenOk ? "bootstrap_llm_first_question(planner)" : "bootstrap_llm_first_question(default)",
      orchestratorAgent: "planner",
      delegatedAgents: [],
      fallback: usedRepair ? true : false,
      ...(usedRepair ? { fallbackReason: "REPAIRED_CONTEXT_USED" } : {}),
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
            finalQuestionSource: (result as { finalQuestionSource: "llm" | "llm_retry" | "repaired_context" })
              .finalQuestionSource,
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
    });

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
