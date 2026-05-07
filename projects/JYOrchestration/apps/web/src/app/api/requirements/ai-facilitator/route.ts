import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  runRequirementsFacilitatorOpenAI,
  runRequirementsIdeationInterviewBootstrapOpenAI,
  runRequirementsIdeationInterviewSeedFromProjectOpenAI,
  type RequirementsAiResponseStyle,
} from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { isPromptTimelineDebugServer, runWithPromptTimelineProject } from "@/lib/debug/promptTimelineDebug";
import { recordIdeationBootstrapOpenAi } from "@/lib/debug/promptTimelineStore";
import {
  buildSingleChatPromptTimelineEntry,
  IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import {
  resolveServicePlanningOrchestrationContext,
  resolveSingleChatAgentContext,
  type SingleChatSelectedAgentWire,
} from "@/lib/requirements/singleChatAgentContext";
import {
  isWorkspaceServicePlanningScreenKey,
  parseWorkspaceScreenKey,
  type WorkspaceScreenKey,
} from "@/lib/workspace-ai/workspaceScreenKeys";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
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

const ALL_ORCH_ROLES = new Set(["planner", "service-designer", "domain-expert", "spec-reviewer", "task-reviewer"]);

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

function initialOrchestrationPayload(projectName: string, projectDescription: string, projectType: string | null, nowIso: string) {
  const defs = buildDynamicServicePlanningSlotDefinitions({
    projectName,
    projectDescription,
    projectType,
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
    const orchInitialForBootstrap =
      projectId && bootstrapInterview ? initialOrchestrationPayload(projectName, projectDescription, projectType, nowIsoInit) : null;

    const orchPlanningCtx = projectId ? await resolveServicePlanningOrchestrationContext(projectId) : null;

    const agentCtxBootstrap =
      projectId && orchPlanningCtx
        ? orchPlanningCtx
        : await resolveSingleChatAgentContext(projectId, workspaceScreenForBootstrap);

    const agentCtxChat = bootstrapInterview
      ? agentCtxBootstrap
      : await resolveSingleChatAgentContext(projectId, workspaceScreenForChat);

    const orchestrationBootstrapInstructions =
      `[오케스트레이션 — 첫 질문]\n` +
      `- 참여 Agent 중 planner(aiOrchestrationRole)가 있으면 반드시 AI 기획자(진행자·라우터) 페르소나로 첫 질문 한 문장만 출력합니다.\n` +
      `- planner 역할이 없으면 동일 규칙으로 기본 서비스 기획자 역할을 수행합니다.\n` +
      `- 질문 주제는 다음 중 하나만 고릅니다: 어떤 서비스를 만들고 싶은지·해결하려는 가장 큰 문제·핵심 사용자.\n` +
      `- 예시 방향: "어떤 서비스를 만들고 싶으신가요?" / "이 서비스가 해결하려는 가장 큰 문제는 무엇인가요?"\n`;

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
      });
      const nowIso = new Date().toISOString();
      const baseState = ensureOrchestrationBaseState({
        raw: body.singleChatOrchestrationV1,
        definitions: defs,
        nowIso,
      });
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
      ? await runWithPromptTimelineProject(projectId, async () =>
          runRequirementsIdeationInterviewBootstrapOpenAI({
            projectName,
            projectDescription,
            participatingAgentsPromptBlock: agentCtxBootstrap.promptBlock,
            orchestrationBootstrapInstructions,
          })
        )
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
          model: null,
          ok: false,
          error: `${result.code}: ${result.message}`,
          fallbackText: IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION,
        });
      }
      const orchPayload =
        orchInitialForBootstrap ??
        (projectId
          ? initialOrchestrationPayload(projectName, projectDescription, projectType, new Date().toISOString())
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
                fallbackText: IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION,
                fallback: true,
                orchestratorAgent: "planner",
                routingDecision: plannerChosen ? "bootstrap_planner_entry(NO_KEY)" : "bootstrap_fallback_planner(NO_KEY)",
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
                  error: `${result.code}: ${result.message}`,
                  fallbackText: IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION,
                  fallback: true,
                  orchestratorAgent: "planner",
                  routingDecision: "bootstrap_error",
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
    const replyTrim = String(result.text ?? "").trim();
    if (bootstrapInterview && !replyTrim) {
      if (bootstrapInterview && isPromptTimelineDebugServer() && projectId) {
        recordIdeationBootstrapOpenAi({
          projectId,
          model: result.model ?? null,
          promptText: result.promptText,
          ok: false,
          error: "EMPTY_REPLY",
          fallbackText: IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION,
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
              fallbackText: IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION,
              fallback: true,
              orchestratorAgent: "planner",
              routingDecision: "bootstrap_empty_reply",
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

    const bootstrapPromptTrace = buildSingleChatPromptTimelineEntry({
      action: "bootstrapInterview",
      source: "llm",
      timelineStage: agentCtxBootstrap.timelineStage,
      stageGroup: agentCtxBootstrap.stageGroup,
      workspaceScreenKey: agentCtxBootstrap.workspaceScreenKey,
      selectedAgents: agentCtxBootstrap.selectedAgents,
      promptText: result.promptText,
      responseText: replyTrim,
      model: result.model,
      provider: result.provider ?? "openai",
      createdAtIso: result.calledAt ?? new Date().toISOString(),
      routingDecision: plannerChosenOk ? "bootstrap_planner_entry" : "bootstrap_default_planner_persona",
      orchestratorAgent: "planner",
      delegatedAgents: [],
      fallback: false,
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
              ...(orchInitialForBootstrap ? { singleChatOrchestrationV1: orchInitialForBootstrap } : {}),
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
