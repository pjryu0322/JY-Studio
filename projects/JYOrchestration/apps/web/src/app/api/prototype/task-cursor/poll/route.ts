import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import { pollTaskCursorExecutionOnce } from "@/lib/prototype/taskCursorPollService";
import { isCursorCloudAgentRunId, parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
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
    const pollResult = await pollTaskCursorExecutionOnce({
      projectId,
      execution,
      workItems: Array.isArray(body.workItems) ? body.workItems : [],
      implementationTaskExecutionStateV1: parseImplementationTaskExecutionStateV1(
        body.implementationTaskExecutionStateV1,
      ),
      verifyGithub: body.verifyGithub !== false,
      context: {
        cursorApiUrl: context.cursorApiUrl!,
        cursorApiToken,
        githubToken,
        targetRepository: context.targetRepository,
        workspaceRoot: context.workspaceRoot,
        baseBranch: context.baseBranch,
        allowedPathGlobs: context.allowedPathGlobs,
      },
    });

    return NextResponse.json({
      success: pollResult.success,
      status: pollResult.status,
      agentStatus: pollResult.agentStatus,
      message: pollResult.message,
      execution: pollResult.execution,
      orchestrationPatch: pollResult.orchestrationPatch,
      executionMode: "task_cursor_poll",
      terminal: pollResult.terminal,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
