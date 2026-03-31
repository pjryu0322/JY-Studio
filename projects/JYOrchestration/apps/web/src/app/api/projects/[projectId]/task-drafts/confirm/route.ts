import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { confirmTaskDraftsToTasks } from "@/lib/project-spec/confirmTaskDraftsService";

type PostBody = {
  draftIds?: string[];
  confirmAll?: boolean;
};

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(
        id,
        userId,
        "canGenerateTask",
        "POST /api/projects/[projectId]/task-drafts/confirm"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: PostBody;
    try {
      body = (await request.json()) as PostBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const draftIds = Array.isArray(body.draftIds)
      ? body.draftIds.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    const confirmAll = Boolean(body.confirmAll);

    if (draftIds.length === 0 && !confirmAll) {
      return NextResponse.json(
        { success: false, message: "draftIds 또는 confirmAll이 필요합니다." },
        { status: 400 }
      );
    }

    try {
      const r = await confirmTaskDraftsToTasks({
        projectId: id,
        userId,
        ...(draftIds.length > 0 ? { draftIds } : { confirmAll: true }),
      });

      if (r.confirmedCount === 0 && (r.promotedDraftRows ?? 0) === 0) {
        return NextResponse.json(
          { success: false, message: "확정할 DRAFT 상태의 초안이 없습니다." },
          { status: 400 }
        );
      }

      const msg =
        r.confirmedCount > 0
          ? `${r.confirmedCount}개 Task 초안을 실제 Task로 반영했습니다.`
          : `초안 ${r.promotedDraftRows ?? 0}개를 확정 처리했습니다.`;

      appendTaskProgressLog({
        kind: "task_drafts",
        phase: "manual_confirm_ok",
        projectId: id,
        userId,
        detail: {
          confirmAll,
          draftIdCount: draftIds.length,
          confirmedCount: r.confirmedCount,
          taskIds: r.taskIds,
          promotedDraftRows: r.promotedDraftRows ?? 0,
        },
      });

      return NextResponse.json({
        success: true,
        message: msg,
        data: {
          confirmedCount: r.confirmedCount,
          taskIds: r.taskIds,
          promotedDraftRows: r.promotedDraftRows ?? 0,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendTaskProgressLog({
        kind: "task_drafts",
        phase: "manual_confirm_error",
        projectId: id,
        userId,
        detail: { message: msg.slice(0, 2000) },
      });
      if (msg === "DRAFT_IDS_OR_CONFIRM_ALL_REQUIRED") {
        return NextResponse.json(
          { success: false, message: "draftIds 또는 confirmAll이 필요합니다." },
          { status: 400 }
        );
      }
      throw e;
    }
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/projects/[projectId]/task-drafts/confirm error:", error);
    return NextResponse.json(
      { success: false, message: "Task 확정 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
