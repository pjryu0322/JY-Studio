import { NextRequest, NextResponse } from "next/server";
import {
  parseAiMemberActionExecutionMode,
  parseAiMemberActionType,
} from "@/lib/ai-member/aiMemberActionTypes";
import { serializeAiMemberActionRow } from "@/lib/ai-member/aiMemberActionApiSerialize";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  AiMemberActionValidationError,
  createAiMemberAction,
  listAiMemberActionsByProject,
  listAiMemberActionsByTask,
  listAiMemberActionsByGitChangeRequest,
} from "@/lib/service/aiMemberActionService";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    const taskId = request.nextUrl.searchParams.get("taskId")?.trim() || "";
    const gitChangeRequestId = request.nextUrl.searchParams.get("gitChangeRequestId")?.trim() || "";
    const n = [projectId, taskId, gitChangeRequestId].filter(Boolean).length;
    if (n !== 1) {
      return NextResponse.json(
        { success: false, message: "projectId, taskId, gitChangeRequestId 중 하나만 지정하세요." },
        { status: 400 }
      );
    }

    const rows = gitChangeRequestId
      ? await listAiMemberActionsByGitChangeRequest(gitChangeRequestId, userId)
      : taskId
        ? await listAiMemberActionsByTask(taskId, userId)
        : await listAiMemberActionsByProject(projectId, userId);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => serializeAiMemberActionRow(r)),
    });
  } catch (error) {
    if (error instanceof AiMemberActionValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/ai-member-actions error:", error);
    return NextResponse.json(
      { success: false, message: "액션 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

type PostBody = {
  projectId?: string;
  projectMemberId?: string;
  actionType?: string;
  taskId?: string | null;
  taskPromptId?: string | null;
  taskRunId?: string | null;
  gitChangeRequestId?: string | null;
  requestPayload?: unknown;
  executionMode?: string | null;
  providerKey?: string | null;
  correlationKey?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const body = (await request.json()) as PostBody;
    const projectId = String(body.projectId ?? "").trim();
    const projectMemberId = String(body.projectMemberId ?? "").trim();
    const actionType = parseAiMemberActionType(body.actionType);
    if (!projectId || !projectMemberId || !actionType) {
      return NextResponse.json(
        { success: false, message: "projectId, projectMemberId, actionType가 필요합니다." },
        { status: 400 }
      );
    }
    const executionMode = body.executionMode ? parseAiMemberActionExecutionMode(body.executionMode) : null;

    const row = await createAiMemberAction({
      projectId,
      projectMemberId,
      actionType,
      taskId: body.taskId ?? null,
      taskPromptId: body.taskPromptId ?? null,
      taskRunId: body.taskRunId ?? null,
      gitChangeRequestId: body.gitChangeRequestId ?? null,
      requestPayload: body.requestPayload ?? null,
      executionMode: executionMode ?? undefined,
      providerKey: body.providerKey ?? null,
      correlationKey: body.correlationKey ?? null,
      requestedByUserId: userId,
    });

    return NextResponse.json({
      success: true,
      data: serializeAiMemberActionRow(row),
    });
  } catch (error) {
    if (error instanceof AiMemberActionValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/ai-member-actions error:", error);
    return NextResponse.json(
      { success: false, message: "액션 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
