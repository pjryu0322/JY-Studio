import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { runServiceFlowAnalyzeOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import {
  buildSingleChatPromptTimelineEntry,
} from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { resolveSingleChatAgentContext } from "@/lib/requirements/singleChatAgentContext";
import { parseWorkspaceScreenKey, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  ideationAssets?: Array<{ type?: string; title?: string; content?: string }>;
  userMessage?: string;
  currentFlow?: RequirementsServiceFlowV1 | null;
  recentMessages?: string;
  latestAiQuestion?: string;
  priorScreenHandoff?: string;
  serviceDesignStage?: string;
  mentionedAI?: string | null;
  responsePolicy?: unknown;
  /** SingleChat 현재 화면 — 절차별 참여 Agent 매핑 조회용 */
  workspaceScreenKey?: string;
};

function parseWorkspaceScreenForBody(raw: unknown): WorkspaceScreenKey {
  const p = parseWorkspaceScreenKey(raw);
  return p ?? "requirements_service_flow";
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const ideationAssets = Array.isArray(body.ideationAssets) ? body.ideationAssets : [];
    const userMessage = String(body.userMessage ?? "").trim();
    const recentMessages = String(body.recentMessages ?? "").trim();
    const latestAiQuestion = String(body.latestAiQuestion ?? "").trim();
    const priorScreenHandoff = String(body.priorScreenHandoff ?? "").trim();
    const currentFlow = (body.currentFlow ?? null) as RequirementsServiceFlowV1 | null;
    const workspaceScreen = parseWorkspaceScreenForBody(body.workspaceScreenKey);

    if (!projectId) return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    if (!userMessage) return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/service-flow-analyze");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const agentCtx = await resolveSingleChatAgentContext(projectId, workspaceScreen);

    const result = await runServiceFlowAnalyzeOpenAI({
      projectName,
      projectDescription,
      ideationAssets,
      userMessage,
      currentFlow,
      recentMessages,
      latestAiQuestion,
      priorScreenHandoff: priorScreenHandoff || undefined,
      participatingAgentsPromptBlock: agentCtx.promptBlock,
    });

    if (!result.ok) {
      const promptTrace = buildSingleChatPromptTimelineEntry({
        action: "serviceFlowAnalyze",
        source: "fallback",
        timelineStage: agentCtx.timelineStage,
        stageGroup: agentCtx.stageGroup,
        workspaceScreenKey: agentCtx.workspaceScreenKey,
        selectedAgents: agentCtx.selectedAgents,
        ...(result.promptText ? { promptText: result.promptText } : {}),
        error: `${result.code}: ${result.message}`,
        fallbackText: "",
      });
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
          meta: { model: null, promptTrace },
        },
        { status: result.code === "NO_KEY" ? 503 : 502 }
      );
    }

    const promptTrace = buildSingleChatPromptTimelineEntry({
      action: "serviceFlowAnalyze",
      source: "llm",
      timelineStage: agentCtx.timelineStage,
      stageGroup: agentCtx.stageGroup,
      workspaceScreenKey: agentCtx.workspaceScreenKey,
      selectedAgents: agentCtx.selectedAgents,
      promptText: result.promptText,
      responseText: String(result.data.assistantMessage ?? "").trim().slice(0, 4000),
      model: result.model,
      provider: "openai",
      createdAtIso: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: result.data, meta: { model: result.model, promptTrace } });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/service-flow-analyze error:", error);
    return NextResponse.json({ success: false, message: "서비스 흐름 분석 중 오류가 발생했습니다." }, { status: 500 });
  }
}
