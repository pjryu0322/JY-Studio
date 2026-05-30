import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import {
  parseImplementationAutoQualityGateV1,
  runImplementationAutoQualityGate,
  shouldAutoStartImplementationQualityGate,
  shouldResumeImplementationAutoQualityGate,
  parseImplementationAutoQualityGateHistoryV1,
} from "@/lib/prototype/implementationAutoQualityGate";
import {
  parseImplementationQualityGateResultsV1,
  type ImplementationQualityGateResultV1,
} from "@/lib/prototype/implementationQualityGate";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const maxDuration = 120;

type Body = {
  readonly projectId?: string;
  readonly taskId?: string;
  readonly taskCursorExecutionV1?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly implementationTaskExecutionStateV1?: unknown;
  readonly implementationQualityGateResultsV1?: unknown;
  readonly implementationAutoQualityGateV1?: unknown;
  readonly implementationAutoQualityGateHistoryV1?: unknown;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly mode?: "review_then_security";
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const taskId = String(body.taskId ?? "").trim();
    const execution = parseTaskCursorExecutionV1(body.taskCursorExecutionV1);
    const taskList = parseImplementationTaskListV1(body.implementationTaskListV1);
    if (!projectId || !execution || !taskList) {
      return NextResponse.json(
        {
          success: false,
          message: "projectId, taskCursorExecutionV1, implementationTaskListV1이 필요합니다.",
        },
        { status: 400 },
      );
    }
    if (taskId && execution.taskId !== taskId) {
      return NextResponse.json(
        { success: false, message: "taskId와 taskCursorExecutionV1.taskId가 일치하지 않습니다." },
        { status: 400 },
      );
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canEditProject",
        "POST /api/prototype/implementation/auto-quality-gate",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const autoGate = parseImplementationAutoQualityGateV1(body.implementationAutoQualityGateV1);
    const shouldStart = shouldAutoStartImplementationQualityGate({
      taskCursorExecution: execution,
      autoGate,
    });
    const shouldResume = shouldResumeImplementationAutoQualityGate({
      taskCursorExecution: execution,
      autoGate,
    });
    if (!shouldStart && !shouldResume) {
      return NextResponse.json({
        success: true,
        status: "skipped",
        message: "자동 품질 게이트가 이미 완료되었거나 실행 중입니다.",
        autoGate,
      });
    }

    const executionState = parseImplementationTaskExecutionStateV1(body.implementationTaskExecutionStateV1);
    const qualityGateResults = parseImplementationQualityGateResultsV1(
      body.implementationQualityGateResultsV1,
    ) as readonly ImplementationQualityGateResultV1[] | null | undefined;

    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId,
      orchestration: {
        implementationTaskListV1: taskList,
        implementationTaskExecutionStateV1: executionState,
        implementationQualityGateResultsV1: qualityGateResults,
      },
    });

    const outcome = runImplementationAutoQualityGate({
      projectId,
      taskCursorExecution: execution,
      taskList,
      executionState,
      qualityGateResults,
      cursorWorkItems: Array.isArray(body.cursorWorkItemsV1) ? body.cursorWorkItemsV1 : [],
      board: board ?? undefined,
      existingTimeline: body.promptTimeline,
      existingAutoQualityGateHistory: parseImplementationAutoQualityGateHistoryV1(
        body.implementationAutoQualityGateHistoryV1,
      ) ?? undefined,
    });

    if ("blocked" in outcome) {
      return NextResponse.json(
        { success: false, status: "blocked", message: outcome.blocked },
        { status: 200 },
      );
    }

    return NextResponse.json({
      success: outcome.ok,
      status: outcome.autoGate.status,
      message: outcome.message,
      autoGate: outcome.autoGate,
      orchestrationPatch: outcome.orchestrationPatch,
      executionMode: "implementation_auto_quality_gate",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
