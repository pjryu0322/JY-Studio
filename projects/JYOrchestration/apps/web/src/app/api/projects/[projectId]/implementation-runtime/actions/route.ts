import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  dispatchNextQueuedImplementationRuntimeRun,
  startImplementationRuntimeJobFromCodeTasks,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";
import {
  DISABLED_IMPLEMENTATION_RUNTIME_USER_ACTION_MESSAGE,
  isDisabledImplementationRuntimeUserAction,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeAdminActions";
import { formatImplementationRuntimeApiError } from "@/lib/runtime/implementationRuntime/implementationRuntimeApiErrors";
import { buildCodeTaskExecutionQueueSnapshotFromDbJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import { buildImplementationQuickRunStartedPatch } from "@/lib/prototype/implementationQuickRun";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveCodeTaskDispatchTarget } from "@/lib/prototype/codeTaskExecutionQueueDispatch";
import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  findDispatchableRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import { tryDispatchCurrentQueuedQuickRunAfterDbAdvance } from "@/lib/prototype/serverQuickRunContinuationService";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { sortCodeTaskIdsByImplementationPlanOrder } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { prisma } from "@/lib/prisma";

type RouteContext = { readonly params: Promise<{ projectId: string }> };
type ActionBody = {
  readonly action?: string;
  readonly selectedCodeTaskIds?: readonly string[];
  readonly jobId?: string;
  readonly cursorAgentId?: string;
  readonly branchName?: string | null;
  readonly clientTrace?: {
    readonly phase?: string;
    readonly detail?: string;
    readonly selectedCount?: number;
  };
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(pid, userId, "canEditProject", "POST implementation-runtime/actions");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json().catch(() => ({}))) as ActionBody;
    const action = String(body.action ?? "").trim();

    if (isDisabledImplementationRuntimeUserAction(action)) {
      return NextResponse.json(
        { success: false, message: DISABLED_IMPLEMENTATION_RUNTIME_USER_ACTION_MESSAGE },
        { status: 400 },
      );
    }

    if (action === "client_trace") {
      const phase = String(body.clientTrace?.phase ?? "").trim() || "unknown";
      const detail = String(body.clientTrace?.detail ?? "").trim();
      const selectedCount = body.clientTrace?.selectedCount;
      console.info("[implementation-runtime] client_trace", {
        projectId: pid,
        phase,
        detail: detail || undefined,
        selectedCount,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "start_job") {
      const idsRaw = (body.selectedCodeTaskIds ?? []).map(String).map((s) => s.trim()).filter(Boolean);
      if (!idsRaw.length) {
        return NextResponse.json({ success: false, message: "selectedCodeTaskIds가 필요합니다." }, { status: 400 });
      }
      const projectRow = await prisma.project.findUnique({
        where: { id: pid },
        select: { requirementsStateJson: true },
      });
      const state = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
      const codeTaskPlan = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1);
      const ids = sortCodeTaskIdsByImplementationPlanOrder(codeTaskPlan, idsRaw);
      console.info("[implementation-runtime] start_job", { projectId: pid, codeTaskCount: ids.length, head: ids[0] });
      const bundle = await startImplementationRuntimeJobFromCodeTasks({
        projectId: pid,
        selectedCodeTaskIds: ids,
      });
      if (!bundle.job?.id) {
        return NextResponse.json({ success: false, message: "Job 생성에 실패했습니다." }, { status: 500 });
      }
      const codeTaskQueueSnapshot = buildCodeTaskExecutionQueueSnapshotFromDbJob({ bundle });
      const headCodeTaskId =
        bundle.currentRun?.codeTaskId?.trim() ?? bundle.job?.currentCodeTaskId?.trim() ?? ids[0]!;
      const requirementsState = state;
      const taskList = parseImplementationTaskListV1(requirementsState.implementationTaskListV1);
      const workItems = requirementsState.cursorWorkItemsV1 ?? [];
      const dispatchTarget = resolveCodeTaskDispatchTarget({
        codeTaskId: headCodeTaskId,
        codeTaskPlan,
        taskList,
        cursorWorkItems: workItems,
      });
      const parentTaskIds = [
        ...new Set(
          ids
            .map((codeTaskId) => {
              const row = codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId);
              return row?.parentTaskId?.trim() ?? "";
            })
            .filter(Boolean),
        ),
      ];
      const nowIso = new Date().toISOString();
      const quickRun = buildImplementationQuickRunStartedPatch({
        projectId: pid,
        currentTaskId: dispatchTarget?.parentTaskId ?? parentTaskIds[0] ?? null,
        selectedTaskIds: parentTaskIds.length ? parentTaskIds : undefined,
        nowIso,
      });
      let codeTaskExecutionRunsV1 =
        parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1) ?? [];
      if (dispatchTarget && !findDispatchableRunForCodeTask(codeTaskExecutionRunsV1, headCodeTaskId)) {
        codeTaskExecutionRunsV1 = appendCodeTaskExecutionRun(
          codeTaskExecutionRunsV1,
          createCodeTaskExecutionRun({
            projectId: pid,
            processTaskId: dispatchTarget.parentTaskId,
            workItemId: dispatchTarget.workItem.id,
            codeTaskId: headCodeTaskId,
            runs: codeTaskExecutionRunsV1,
            nowIso,
          }),
        );
      }
      await persistTaskCursorOrchestrationToProject({
        projectId: pid,
        orchestrationPatch: { implementationQuickRunV1: quickRun, codeTaskExecutionRunsV1 },
      });

      const quickRunDispatch = await tryDispatchCurrentQueuedQuickRunAfterDbAdvance({
        projectId: pid,
        nowIso,
      });
      if (quickRunDispatch.orchestrationPatch) {
        await persistTaskCursorOrchestrationToProject({
          projectId: pid,
          orchestrationPatch: quickRunDispatch.orchestrationPatch,
        });
      }
      const bundleAfterDispatch = await getImplementationRuntimeBundle(pid);

      return NextResponse.json({
        success: true,
        bundle: bundleAfterDispatch.job?.id ? bundleAfterDispatch : bundle,
        firstRun: bundleAfterDispatch.currentRun ?? bundle.currentRun,
        implementationQuickRunV1: quickRun,
        quickRunDispatch: {
          ok: quickRunDispatch.ok,
          outcome: quickRunDispatch.outcome,
          reason: quickRunDispatch.reason,
          orchestrationPatch: quickRunDispatch.orchestrationPatch,
        },
        ...(codeTaskQueueSnapshot ? { codeTaskQueueSnapshot } : {}),
      });
    }

    if (action === "dispatch_next") {
      const jobId =
        String(body.jobId ?? "").trim() || (await getImplementationRuntimeBundle(pid)).job?.id;
      if (!jobId) {
        return NextResponse.json({ success: false, message: "active job이 없습니다." }, { status: 400 });
      }
      const agentId = String(body.cursorAgentId ?? "").trim();
      if (!agentId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Cursor dispatch는 POST /api/prototype/task-cursor/execute(launchOnly)를 사용하세요. 테스트용으로 cursorAgentId를 전달하면 dispatch_next가 동작합니다.",
          },
          { status: 400 },
        );
      }
      const bundle = await dispatchNextQueuedImplementationRuntimeRun({
        projectId: pid,
        jobId,
        buildCursorRequest: async () => ({
          agentId,
          branchName: body.branchName ?? null,
        }),
      });
      return NextResponse.json({ success: true, bundle });
    }

    return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = formatImplementationRuntimeApiError(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
