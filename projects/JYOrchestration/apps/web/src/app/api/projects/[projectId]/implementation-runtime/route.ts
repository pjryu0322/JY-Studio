import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  getImplementationRuntimeBundle,
  listImplementationRuntimeEvents,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { buildImplementationRuntimeUiSnapshotFromBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiSnapshot";
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

    const bundle = await getImplementationRuntimeBundle(pid);
    const codeTaskQueueSnapshot = buildCodeTaskExecutionQueueSnapshotFromDbJob({ bundle });
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
      uiSnapshot: buildImplementationRuntimeUiSnapshotFromBundle(bundle),
      ...(codeTaskQueueSnapshot ? { codeTaskQueueSnapshot } : {}),
      diagnostics,
      events,
    });
  } catch (error) {
    const message = formatImplementationRuntimeApiError(error);
    console.error("[implementation-runtime] GET failed:", error);
    const status = isImplementationRuntimeSchemaError(error) ? 503 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
