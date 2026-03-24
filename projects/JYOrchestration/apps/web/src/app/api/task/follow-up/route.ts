import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { requireTaskGenerate } from "@/lib/service/projectAccessGuard";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import { createFollowUpTaskAfterDoneSource } from "@/lib/service/taskService";

type FollowUpBody = {
  projectId?: string;
  sourceTaskId?: string;
  name?: string;
  description?: string;
  changeReason?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const body = (await request.json()) as FollowUpBody;
    const projectId = String(body.projectId ?? "").trim();
    const sourceTaskId = String(body.sourceTaskId ?? "").trim();
    const name = String(body.name ?? "").trim();
    const rawDesc = body.description;
    const description =
      rawDesc === undefined || rawDesc === null ? null : String(rawDesc).trim() || null;
    const changeReason = String(body.changeReason ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!sourceTaskId) {
      return NextResponse.json({ success: false, message: "sourceTaskId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireTaskGenerate(projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const result = await createFollowUpTaskAfterDoneSource({
      projectId,
      sourceTaskId,
      name,
      description,
      changeReason,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    const { followUp } = result;

    try {
      await appendTaskHistory({
        projectId,
        taskId: followUp.id,
        actorType: TaskHistoryActorType.USER,
        actorId: userId,
        eventType: TaskHistoryEventType.FOLLOWUP_TASK_CREATED,
        summary: "완료된 Task의 보완 작업이 생성되었습니다.",
        detailJson: {
          sourceTaskId,
          followUpTaskId: followUp.id,
          reason: changeReason,
          insertedOrder: followUp.order,
        },
      });
    } catch (historyError) {
      console.error("FOLLOWUP_TASK_CREATED history append failed:", historyError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: followUp.id,
        parentTaskId: followUp.parentTaskId,
        taskKind: followUp.taskKind,
        order: followUp.order,
      },
      message: "보완 작업이 생성되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/task/follow-up error:", error);
    return NextResponse.json(
      { success: false, message: "보완 Task 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
