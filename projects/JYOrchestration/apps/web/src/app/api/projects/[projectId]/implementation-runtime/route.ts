import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  getImplementationRuntimeBundle,
  listImplementationRuntimeEvents,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  ensureQueuedRunForRedispatch,
  recoverImplementationRuntimeDb,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRecovery";
import { pollDueImplementationRuntimeForProject } from "@/lib/runtime/implementationRuntime/implementationRuntimePollService";
import { buildImplementationRuntimeUiSnapshot } from "@/lib/runtime/implementationRuntime/implementationRuntimeJsonBridge";
import { buildCodeTaskExecutionQueueSnapshotFromDbJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import { formatRuntimeStateKoForUser } from "@/lib/runtime/implementationRuntime/implementationRuntimeGithubCentricModel";
import {
  formatImplementationRuntimeApiError,
  isImplementationRuntimeSchemaError,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeApiErrors";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(pid, userId, "canViewProject", "GET implementation-runtime");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const recoverOnLoad = request.nextUrl.searchParams.get("recover") === "1";
    let recoveryWarning: string | null = null;
    if (recoverOnLoad) {
      try {
        const recovery = await recoverImplementationRuntimeDb({ projectId: pid });
        if (recovery.shouldRedispatch && recovery.redispatchCodeTaskId) {
          const pre = await getImplementationRuntimeBundle(pid);
          if (pre.job) {
            await ensureQueuedRunForRedispatch({
              projectId: pid,
              jobId: pre.job.id,
              codeTaskId: recovery.redispatchCodeTaskId,
            });
          }
        }
        try {
          await pollDueImplementationRuntimeForProject(pid);
        } catch (pollError) {
          recoveryWarning = formatImplementationRuntimeApiError(pollError);
          console.warn("[implementation-runtime] recover poll skipped:", recoveryWarning);
        }
      } catch (recoverError) {
        recoveryWarning = formatImplementationRuntimeApiError(recoverError);
        console.warn("[implementation-runtime] recover skipped:", recoveryWarning);
      }
    }

    const bundle = await getImplementationRuntimeBundle(pid);
    const codeTaskQueueSnapshot = await buildCodeTaskExecutionQueueSnapshotFromDbJob({ bundle });
    const events = await listImplementationRuntimeEvents({ projectId: pid, limit: 30 });
    const diagnostics = bundle.runs.map((run) => ({
      codeTaskId: run.codeTaskId,
      runtimeState: run.runtimeState,
      runtimeStateLabel: formatRuntimeStateKoForUser(run.runtimeState, {
        commitSha: run.commitSha,
        pullRequestUrl: run.pullRequestUrl,
        githubState:
          run.runtimeState === "github_verifying"
            ? "pending"
            : run.commitSha
              ? "verified"
              : "none",
      }),
      cursorState: run.cursorAgentId ?? "—",
      githubState:
        run.runtimeState === "github_verifying"
          ? "pending"
          : run.commitSha
            ? "verified"
            : "none",
      lastUpdate: run.lastHeartbeatAt ?? run.updatedAt,
      heartbeat: run.lastHeartbeatAt,
    }));

    return NextResponse.json({
      success: true,
      bundle,
      uiSnapshot: buildImplementationRuntimeUiSnapshot(bundle),
      ...(codeTaskQueueSnapshot ? { codeTaskQueueSnapshot } : {}),
      diagnostics,
      events,
      ...(recoveryWarning ? { recoveryWarning } : {}),
    });
  } catch (error) {
    const message = formatImplementationRuntimeApiError(error);
    console.error("[implementation-runtime] GET failed:", error);
    const status = isImplementationRuntimeSchemaError(error) ? 503 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
