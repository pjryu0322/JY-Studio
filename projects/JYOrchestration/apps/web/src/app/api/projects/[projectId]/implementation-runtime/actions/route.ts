import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  createImplementationCodeTaskRun,
  createImplementationRuntimeJob,
  getImplementationRuntimeBundle,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  ensureQueuedRunForRedispatch,
  recoverImplementationRuntimeDb,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRecovery";
import { syncImplementationRuntimeFromRequirementsJson } from "@/lib/runtime/implementationRuntime/implementationRuntimeJsonBridge";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

type RouteContext = { readonly params: Promise<{ projectId: string }> };
type ActionBody = {
  readonly action?: string;
  readonly selectedCodeTaskIds?: readonly string[];
  readonly requirementsState?: Record<string, unknown>;
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
      const started = await createImplementationRuntimeJob({ projectId: pid, selectedCodeTaskIds: ids });
      const jobId = started.job?.id;
      if (!jobId) {
        return NextResponse.json({ success: false, message: "Job 생성에 실패했습니다." }, { status: 500 });
      }
      const first = await createImplementationCodeTaskRun({
        projectId: pid,
        jobId,
        codeTaskId: ids[0]!,
      });
      return NextResponse.json({
        success: true,
        bundle: await getImplementationRuntimeBundle(pid),
        firstRun: first,
      });
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
