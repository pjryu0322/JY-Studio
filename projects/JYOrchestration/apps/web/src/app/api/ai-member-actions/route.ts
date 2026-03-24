import { NextRequest, NextResponse } from "next/server";
import {
  parseAiMemberActionExecutionMode,
  parseAiMemberActionType,
} from "@/lib/ai-member/aiMemberActionTypes";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  AiMemberActionValidationError,
  createAiMemberAction,
  listAiMemberActionsByProject,
  listAiMemberActionsByTask,
} from "@/lib/service/aiMemberActionService";

function serializeRow(row: {
  id: string;
  projectId: string;
  taskId: string | null;
  taskPromptId: string | null;
  taskRunId: string | null;
  gitChangeRequestId: string | null;
  projectMemberId: string;
  actionType: string;
  status: string;
  requestPayload: unknown;
  resultPayload: unknown;
  requestedByUserId: string;
  requestedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  executionMode: string;
  updatedAt: Date;
  projectMember: {
    id: string;
    displayName: string | null;
    memberType: string;
    role: string;
    aiProvider: string | null;
  };
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    taskPromptId: row.taskPromptId,
    taskRunId: row.taskRunId,
    gitChangeRequestId: row.gitChangeRequestId,
    projectMemberId: row.projectMemberId,
    actionType: row.actionType,
    status: row.status,
    requestPayload: row.requestPayload,
    resultPayload: row.resultPayload,
    requestedByUserId: row.requestedByUserId,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    executionMode: row.executionMode,
    updatedAt: row.updatedAt.toISOString(),
    targetMember: {
      id: row.projectMember.id,
      displayName: row.projectMember.displayName,
      memberType: row.projectMember.memberType,
      role: row.projectMember.role,
      aiProvider: row.projectMember.aiProvider,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    const taskId = request.nextUrl.searchParams.get("taskId")?.trim() || "";
    if (!projectId && !taskId) {
      return NextResponse.json(
        { success: false, message: "projectId 또는 taskId 쿼리가 필요합니다." },
        { status: 400 }
      );
    }
    if (projectId && taskId) {
      return NextResponse.json(
        { success: false, message: "projectId와 taskId는 동시에 지정할 수 없습니다." },
        { status: 400 }
      );
    }

    const rows = taskId
      ? await listAiMemberActionsByTask(taskId, userId)
      : await listAiMemberActionsByProject(projectId, userId);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => serializeRow(r)),
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
      requestedByUserId: userId,
    });

    return NextResponse.json({
      success: true,
      data: serializeRow(row),
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
