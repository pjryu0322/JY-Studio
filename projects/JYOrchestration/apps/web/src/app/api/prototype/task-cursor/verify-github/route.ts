import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { mapExecutionSetupPrismaRowToSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  applyTaskCursorGithubVerifyResult,
  buildTaskCursorGithubVerifyTimeline,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import {
  evaluateTaskCursorGithubVerifyReadiness,
  verifyTaskCursorGithubResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import {
  buildTaskCursorTimelineEntry,
  parseTaskCursorExecutionV1,
  patchTaskCursorExecution,
  TASK_CURSOR_FAILURE_MESSAGES,
} from "@/lib/prototype/taskCursorExecution";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { prisma } from "@/lib/prisma";

type Body = {
  readonly projectId?: string;
  readonly execution?: unknown;
  readonly implementationTaskExecutionStateV1?: unknown;
  readonly workItems?: readonly import("@/lib/prototype/implementationCursorWorkItems").CursorWorkItem[];
};

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  allowedPathGlobs: true,
  githubAccessToken: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const execution = parseTaskCursorExecutionV1(body.execution);
    if (!projectId || !execution) {
      return NextResponse.json(
        { success: false, message: "projectId와 taskCursorExecutionV1이 필요합니다." },
        { status: 400 },
      );
    }
    if (execution.status === "cursor_requested" || execution.status === "cursor_running") {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message:
            "Cursor Cloud Agent가 아직 실행 중입니다. Agent 완료 후 자동으로 GitHub commit 확인이 진행되거나, 완료 뒤 [GitHub 결과 확인]을 눌러 주세요.",
        },
        { status: 200 },
      );
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canViewProject",
        "POST /api/prototype/task-cursor/verify-github",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const setupRow = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: EXECUTION_SETUP_SELECT,
    });
    const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);
    const readiness = evaluateTaskCursorGithubVerifyReadiness({ setup });
    if (!readiness.ok) {
      return NextResponse.json(
        { success: false, status: "blocked", message: readiness.message },
        { status: 200 },
      );
    }

    const githubToken = String(setupRow?.githubAccessToken ?? "").trim();
    if (!githubToken) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed,
        },
        { status: 200 },
      );
    }

    const nowIso = new Date().toISOString();
    let nextExecution = patchTaskCursorExecution(execution, { status: "github_verifying", nowIso });
    const timeline = [
      buildTaskCursorTimelineEntry({
        action: "task_cursor_github_verify_requested",
        projectId,
        taskId: nextExecution.taskId,
        status: "github_verifying",
        targetRepository: nextExecution.targetRepository,
        baseBranch: nextExecution.baseBranch,
        workBranch: nextExecution.workBranch,
        commitSha: nextExecution.commitSha,
        runId: nextExecution.cursorRunId,
        nowIso,
      }),
    ];

    const verify = await verifyTaskCursorGithubResult({
      execution: nextExecution,
      targetRepository: readiness.targetRepository,
      githubToken,
      allowedPathGlobs: readiness.allowedPathGlobs,
    });

    nextExecution = applyTaskCursorGithubVerifyResult({
      execution: nextExecution,
      ok: verify.ok,
      message: verify.message,
      verifiedChangedFiles: verify.verifiedChangedFiles,
      verifiedCommitSha: verify.verifiedCommitSha,
      nowIso,
    });
    if (nextExecution.status === "github_verified") {
      nextExecution = patchTaskCursorExecution(nextExecution, { status: "review_pending", nowIso });
    }
    timeline.push(
      buildTaskCursorGithubVerifyTimeline({
        execution: nextExecution,
        ok: verify.ok,
        reason: verify.reason,
        nowIso,
      }),
    );

    const patch = buildTaskCursorOrchestrationPatch({
      execution: nextExecution,
      timelineEntries: timeline,
      cursorWorkItems: Array.isArray(body.workItems) ? body.workItems : [],
      ...(parseImplementationTaskExecutionStateV1(body.implementationTaskExecutionStateV1)
        ? {
            executionState: parseImplementationTaskExecutionStateV1(
              body.implementationTaskExecutionStateV1,
            ),
          }
        : {}),
    });

    return NextResponse.json({
      success: verify.ok,
      status: nextExecution.status,
      verify,
      execution: nextExecution,
      orchestrationPatch: patch,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
