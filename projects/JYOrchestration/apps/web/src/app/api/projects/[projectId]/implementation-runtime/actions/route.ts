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
  ensureQueuedRunForRedispatch,
  recoverImplementationRuntimeDb,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRecovery";
import { syncImplementationRuntimeFromRequirementsJson } from "@/lib/runtime/implementationRuntime/implementationRuntimeJsonBridge";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";
import { formatImplementationRuntimeApiError } from "@/lib/runtime/implementationRuntime/implementationRuntimeApiErrors";
import { buildCodeTaskExecutionQueueSnapshotFromDbJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import { syncQueueItemsForJobStart } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";

type RouteContext = { readonly params: Promise<{ projectId: string }> };
type ActionBody = {
  readonly action?: string;
  readonly selectedCodeTaskIds?: readonly string[];
  readonly queueItems?: readonly {
    readonly codeTaskId?: string;
    readonly parentTaskId?: string;
    readonly workItemId?: string | null;
  }[];
  readonly requirementsState?: Record<string, unknown>;
  readonly jobId?: string;
  readonly cursorAgentId?: string;
  readonly branchName?: string | null;
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

    if (action === "sync_from_json") {
      const project = await prisma.project.findUnique({
        where: { id: pid },
        select: { requirementsStateJson: true },
      });
      const raw =
        body.requirementsState ??
        (parseRequirementsStateJson(project?.requirementsStateJson) as Record<string, unknown>);
      const result = await syncImplementationRuntimeFromRequirementsJson({
        projectId: pid,
        requirementsState: raw,
        force: false,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "start_job") {
      const ids = (body.selectedCodeTaskIds ?? []).map(String).map((s) => s.trim()).filter(Boolean);
      if (!ids.length) {
        return NextResponse.json({ success: false, message: "selectedCodeTaskIds가 필요합니다." }, { status: 400 });
      }
      const bundle = await startImplementationRuntimeJobFromCodeTasks({
        projectId: pid,
        selectedCodeTaskIds: ids,
      });
      if (!bundle.job?.id) {
        return NextResponse.json({ success: false, message: "Job 생성에 실패했습니다." }, { status: 500 });
      }
      const queueMeta = body.queueItems ?? [];
      await syncQueueItemsForJobStart({
        projectId: pid,
        jobId: bundle.job.id,
        selectedCodeTaskIds: ids,
        ...(queueMeta.length
          ? {
              resolveMeta: (codeTaskId) => {
                const row = queueMeta.find((q) => String(q.codeTaskId ?? "").trim() === codeTaskId);
                return {
                  parentTaskId: String(row?.parentTaskId ?? codeTaskId).trim(),
                  workItemId: row?.workItemId ?? null,
                };
              },
            }
          : {}),
      });
      const codeTaskQueueSnapshot = await buildCodeTaskExecutionQueueSnapshotFromDbJob({ bundle });
      return NextResponse.json({
        success: true,
        bundle,
        firstRun: bundle.currentRun,
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

    if (action === "recover") {
      const recovery = await recoverImplementationRuntimeDb({ projectId: pid });
      if (recovery.shouldRedispatch && recovery.redispatchCodeTaskId) {
        const bundle = await getImplementationRuntimeBundle(pid);
        if (bundle.job) {
          await ensureQueuedRunForRedispatch({
            projectId: pid,
            jobId: bundle.job.id,
            codeTaskId: recovery.redispatchCodeTaskId,
          });
        }
      }
      return NextResponse.json({
        success: true,
        recovery,
        bundle: await getImplementationRuntimeBundle(pid),
      });
    }

    if (action === "force_release") {
      const recovery = await recoverImplementationRuntimeDb({ projectId: pid, forceRelease: true });
      return NextResponse.json({
        success: true,
        recovery,
        bundle: await getImplementationRuntimeBundle(pid),
      });
    }

    if (action === "redispatch") {
      const bundle = await getImplementationRuntimeBundle(pid);
      if (!bundle.job?.currentCodeTaskId) {
        return NextResponse.json({ success: false, message: "재디스패치할 CodeTask가 없습니다." }, { status: 400 });
      }
      await ensureQueuedRunForRedispatch({
        projectId: pid,
        jobId: bundle.job.id,
        codeTaskId: bundle.job.currentCodeTaskId,
      });
      return NextResponse.json({ success: true, bundle: await getImplementationRuntimeBundle(pid) });
    }

    return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    const message = formatImplementationRuntimeApiError(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
