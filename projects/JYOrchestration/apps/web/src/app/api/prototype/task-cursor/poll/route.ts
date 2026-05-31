import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import {
  applyTaskCursorApiResult,
  applyTaskCursorGithubVerifyResult,
  buildTaskCursorApiCompletedTimeline,
  buildTaskCursorApiFailedTimeline,
  buildTaskCursorGithubVerifyTimeline,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { pollTaskCursorCloudAgentStep } from "@/lib/prototype/taskCursorCloudAgentClient";
import { verifyTaskCursorGithubResult } from "@/lib/prototype/taskCursorGithubVerify";
import {
  buildTaskCursorTimelineEntry,
  isCursorCloudAgentRunId,
  parseTaskCursorExecutionV1,
  patchTaskCursorExecution,
} from "@/lib/prototype/taskCursorExecution";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

type Body = {
  readonly projectId?: string;
  readonly taskCursorExecutionV1?: unknown;
  readonly workItems?: readonly CursorWorkItem[];
  readonly verifyGithub?: boolean;
  readonly implementationTaskExecutionStateV1?: unknown;
};

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  cursorApiUrl: true,
  cursorApiToken: true,
  githubAccessToken: true,
  allowedPathGlobs: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const execution = parseTaskCursorExecutionV1(body.taskCursorExecutionV1);
    if (!projectId || !execution) {
      return NextResponse.json(
        { success: false, message: "projectId와 taskCursorExecutionV1이 필요합니다." },
        { status: 400 },
      );
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype/task-cursor/poll");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const agentId = String(execution.cursorRunId ?? "").trim();
    if (!agentId) {
      return NextResponse.json(
        { success: false, message: "cursorRunId(Cloud Agent id)가 없습니다." },
        { status: 200 },
      );
    }
    if (!isCursorCloudAgentRunId(agentId)) {
      return NextResponse.json({
        success: false,
        status: "poll_not_ready",
        message: "Cloud Agent ID가 아직 준비되지 않았습니다. launch 완료 후 다시 폴링합니다.",
        execution,
        executionMode: "task_cursor_poll",
      });
    }

    const setupRow = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: EXECUTION_SETUP_SELECT,
    });
    const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);
    const readiness = evaluateExecutionSetupSourceGenerationReadiness({
      setup,
      env: process.env as Record<string, string | undefined>,
    });
    if (!readiness.ok) {
      return NextResponse.json(
        { success: false, status: "blocked", message: readiness.message },
        { status: 200 },
      );
    }

    const cursorApiToken = String(setupRow?.cursorApiToken ?? "").trim();
    const githubToken = String(setupRow?.githubAccessToken ?? "").trim();
    if (!cursorApiToken) {
      return NextResponse.json(
        { success: false, status: "blocked", message: "Cursor API Key가 없습니다." },
        { status: 200 },
      );
    }

    const { context } = readiness;
    const nowIso = new Date().toISOString();
    const executionState = parseImplementationTaskExecutionStateV1(body.implementationTaskExecutionStateV1);
    const buildPatch = (execution: ReturnType<typeof patchTaskCursorExecution>, timelineEntries: typeof timeline) =>
      buildTaskCursorOrchestrationPatch({
        execution,
        timelineEntries,
        cursorWorkItems: Array.isArray(body.workItems) ? body.workItems : [],
        ...(executionState ? { executionState } : {}),
      });
    const pollStep = await pollTaskCursorCloudAgentStep({
      request: {
        projectId,
        taskId: execution.taskId,
        workItemIds: execution.workItemIds,
        workItems: Array.isArray(body.workItems) ? body.workItems : [],
        cursorApiUrl: context.cursorApiUrl!,
        cursorApiToken,
        targetRepository: context.targetRepository,
        workspacePath: context.workspaceRoot,
        baseBranch: context.baseBranch,
        workBranch: execution.workBranch,
        commitMessage: "",
        prompt: execution.cursorPrompt ?? "",
        allowedPathGlobs: context.allowedPathGlobs,
      },
      agentId,
    });

    const timeline = [];
    let nextExecution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });

    if (pollStep.kind === "running") {
      nextExecution = patchTaskCursorExecution(execution, {
        status: "cursor_running",
        cursorAgentStatus: pollStep.statusUpper,
        nowIso,
      });
      return NextResponse.json({
        success: true,
        status: "cursor_running",
        agentStatus: pollStep.statusUpper,
        execution: nextExecution,
        orchestrationPatch: buildPatch(nextExecution, timeline),
        executionMode: "task_cursor_poll",
      });
    }
    if (pollStep.kind === "failed") {
      nextExecution = patchTaskCursorExecution(execution, {
        status: "cursor_failed",
        failureReason: pollStep.reason,
        errorMessage: pollStep.message,
        nowIso,
      });
      timeline.push(buildTaskCursorApiFailedTimeline({ execution: nextExecution, nowIso }));
      const patch = buildPatch(nextExecution, timeline);
      return NextResponse.json({
        success: false,
        status: nextExecution.status,
        execution: nextExecution,
        orchestrationPatch: patch,
        executionMode: "task_cursor_poll",
      });
    }

    nextExecution = applyTaskCursorApiResult({
      execution,
      result: pollStep.result,
      nowIso,
    });
    timeline.push(buildTaskCursorApiCompletedTimeline({ execution: nextExecution, nowIso }));

    const verifyGithub = body.verifyGithub !== false;
    if (nextExecution.status === "cursor_completed" && verifyGithub && githubToken) {
      nextExecution = patchTaskCursorExecution(nextExecution, { status: "github_verifying", nowIso });
      timeline.push(
        buildTaskCursorTimelineEntry({
          action: "task_cursor_github_verify_requested",
          projectId,
          taskId: execution.taskId,
          status: "github_verifying",
          targetRepository: nextExecution.targetRepository,
          baseBranch: nextExecution.baseBranch,
          workBranch: nextExecution.workBranch,
          commitSha: nextExecution.commitSha,
          runId: nextExecution.cursorRunId,
          nowIso,
        }),
      );
      const verify = await verifyTaskCursorGithubResult({
        execution: nextExecution,
        targetRepository: context.targetRepository,
        githubToken,
        allowedPathGlobs: context.allowedPathGlobs,
      });
      nextExecution = applyTaskCursorGithubVerifyResult({
        execution: nextExecution,
        ok: verify.ok,
        message: verify.message,
        reason: verify.reason,
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
    }

    const patch = buildPatch(nextExecution, timeline);

    return NextResponse.json({
      success: pollStep.result.ok,
      status: nextExecution.status,
      result: pollStep.result,
      execution: nextExecution,
      orchestrationPatch: patch,
      executionMode: "task_cursor_poll",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
