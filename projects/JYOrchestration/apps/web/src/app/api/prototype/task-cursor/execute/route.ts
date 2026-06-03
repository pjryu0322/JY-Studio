import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { buildProviderWipCommitMessage } from "@/lib/prototype/codeAgentProvider";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
import { ensureTargetRepositoryWorktree } from "@/lib/prototype/cursorBridgeTargetRepoGit";
import { resolveDefaultGitWorkspaceCloneRoot } from "@/lib/prototype/gitRepoAutoWorkspace";
import { validateWorkspaceMatchesTargetRepository } from "@/lib/prototype/workspaceTargetRepositoryValidation";
import {
  applyTaskCursorApiResult,
  applyTaskCursorGithubVerifyResult,
  buildTaskCursorApiCompletedTimeline,
  buildTaskCursorApiFailedTimeline,
  buildTaskCursorApiStartedTimeline,
  buildTaskCursorExecutionRequest,
  buildTaskCursorGithubVerifyTimeline,
  buildTaskCursorOrchestrationPatch,
  buildTaskCursorRequestedTimeline,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { buildTaskCursorAuthRef, executeTaskCursorApi, shouldUseTaskCursorCloudAgentApi } from "@/lib/prototype/taskCursorApiClient";
import { launchTaskCursorCloudAgent } from "@/lib/prototype/taskCursorCloudAgentClient";
import { verifyTaskCursorGithubResult } from "@/lib/prototype/taskCursorGithubVerify";
import {
  buildTaskCursorTimelineEntry,
  patchTaskCursorExecution,
  parseTaskCursorExecutionV1,
  TASK_CURSOR_FAILURE_MESSAGES,
} from "@/lib/prototype/taskCursorExecution";
import { prisma } from "@/lib/prisma";
import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";
import { upsertTaskCursorExecutionJobFromLaunch } from "@/lib/prototype/taskCursorExecutionJobRepository";
import { buildTaskCursorJobLifecycleTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";
import { linkTaskCursorJobToImplementationRun } from "@/lib/runtime/implementationRuntime/implementationRuntimePollRepository";
import { dispatchQueuedImplementationRuntimeRunWithCursor } from "@/lib/prototype/selectedCodeTaskCursorExecution";

type Body = {
  readonly projectId?: string;
  readonly taskId?: string;
  readonly codeTaskId?: string;
  readonly selectedWorkItemIds?: readonly string[];
  readonly workItems?: readonly CursorWorkItem[];
  readonly verifyGithub?: boolean;
  readonly launchOnly?: boolean;
};

export const maxDuration = 120;

const EXECUTION_SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  workspacePath: true,
  allowedPathGlobs: true,
  autoCommit: true,
  autoPush: true,
  autoPr: true,
  cursorApiUrl: true,
  cursorApiToken: true,
  githubAccessToken: true,
} as const;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const taskId = String(body.taskId ?? "").trim();
    if (!projectId || !taskId) {
      return NextResponse.json(
        { success: false, message: "projectId와 taskId가 필요합니다." },
        { status: 400 },
      );
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype/task-cursor/execute");
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
    const readiness = evaluateExecutionSetupSourceGenerationReadiness({
      setup,
      env: process.env as Record<string, string | undefined>,
    });
    const availability = evaluateCursorExecutionAvailability({ setup });

    if (!readiness.ok) {
      return NextResponse.json(
        { success: false, status: "blocked", message: readiness.message, missing: readiness.missing },
        { status: 200 },
      );
    }

    const cursorApiToken = String(setupRow?.cursorApiToken ?? "").trim();
    const githubToken = String(setupRow?.githubAccessToken ?? "").trim();
    if (!cursorApiToken) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message: TASK_CURSOR_FAILURE_MESSAGES.cursor_auth_failed,
          authRef: buildTaskCursorAuthRef({ hasCursorToken: false, hasGithubAccessToken: Boolean(githubToken) }),
        },
        { status: 200 },
      );
    }
    if (!githubToken) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message: TASK_CURSOR_FAILURE_MESSAGES.github_auth_failed,
          authRef: buildTaskCursorAuthRef({ hasCursorToken: true, hasGithubAccessToken: false }),
        },
        { status: 200 },
      );
    }
    if (!availability.ready) {
      return NextResponse.json(
        { success: false, status: "blocked", message: availability.reason, availability },
        { status: 200 },
      );
    }

    const { context } = readiness;
    const workItems = Array.isArray(body.workItems) ? body.workItems : [];
    const selectedWorkItemIds = Array.isArray(body.selectedWorkItemIds)
      ? body.selectedWorkItemIds.map((id) => String(id))
      : workItems.filter((w) => w.taskId === taskId).map((w) => w.id);
    const scopedWorkItems = workItems.filter(
      (w) => w.taskId === taskId && (selectedWorkItemIds.length ? selectedWorkItemIds.includes(w.id) : true),
    );
    if (!scopedWorkItems.length) {
      return NextResponse.json(
        { success: false, status: "blocked", message: `${taskId}에 해당하는 WorkItem이 없습니다.` },
        { status: 200 },
      );
    }

    let workspaceRoot = context.workspaceRoot;
    if (context.workspaceRootSource === "execution_setup") {
      const workspaceMatch = await validateWorkspaceMatchesTargetRepository({
        workspacePath: workspaceRoot,
        targetRepoFullName: context.targetRepository.repoFullName,
      });
      if (!workspaceMatch.ok) {
        return NextResponse.json(
          { success: false, status: "blocked", message: workspaceMatch.reason },
          { status: 200 },
        );
      }
    } else if (context.workspaceRootSource === "git_repo_auto") {
      const cloneRootRaw = resolveDefaultGitWorkspaceCloneRoot(
        process.env as Record<string, string | undefined>,
      );
      const cloneRoot = path.isAbsolute(cloneRootRaw)
        ? cloneRootRaw
        : path.join(process.cwd(), cloneRootRaw);
      const workBranch = `wip/cursor/${taskId.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}`;
      try {
        const prepared = await ensureTargetRepositoryWorktree({
          cloneRoot,
          targetRepository: context.targetRepository,
          baseBranch: context.baseBranch,
          workBranch,
        });
        workspaceRoot = prepared.workdir;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
          { success: false, status: "blocked", message: `Git 작업공간 준비 실패: ${message}` },
          { status: 200 },
        );
      }
    }

    const nowIso = new Date().toISOString();
    let execution = buildTaskCursorExecutionRequest({
      projectId,
      taskId,
      workItemIds: scopedWorkItems.map((w) => w.id),
      workItems: scopedWorkItems,
      targetRepository: context.targetRepository,
      baseBranch: context.baseBranch,
      allowedPathGlobs: context.allowedPathGlobs,
      nowIso,
    });
    execution = patchTaskCursorExecution(execution, { status: "cursor_requested", nowIso });

    const timeline = [
      ...buildTaskCursorRequestedTimeline({ execution, nowIso }),
      buildTaskCursorApiStartedTimeline({ execution, nowIso }),
    ];
    execution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });

    const commitMessage = buildProviderWipCommitMessage("cursor", `task ${taskId}`, false, taskId);
    const apiRequest = {
      projectId,
      taskId,
      workItemIds: scopedWorkItems.map((w) => w.id),
      workItems: scopedWorkItems,
      cursorApiUrl: readiness.context.cursorApiUrl!,
      cursorApiToken,
      targetRepository: context.targetRepository,
      workspacePath: workspaceRoot,
      baseBranch: context.baseBranch,
      workBranch: execution.workBranch,
      commitMessage,
      prompt: execution.cursorPrompt ?? "",
      allowedPathGlobs: context.allowedPathGlobs,
    };

    const launchOnly = body.launchOnly !== false;
    const useCloudAgentLaunch =
      launchOnly && shouldUseTaskCursorCloudAgentApi(readiness.context.cursorApiUrl!);

    if (useCloudAgentLaunch) {
      const codeTaskIdForRuntime = String(body.codeTaskId ?? taskId).trim();
      let launchOk = false;
      let launchMessage: string | undefined;

      try {
        const dbDispatched = await dispatchQueuedImplementationRuntimeRunWithCursor({
          projectId,
          codeTaskId: codeTaskIdForRuntime,
          launch: async () => {
            const launch = await launchTaskCursorCloudAgent(apiRequest);
            if (!launch.ok) {
              throw new Error(launch.message ?? TASK_CURSOR_FAILURE_MESSAGES.unknown);
            }
            return { agentId: launch.agentId, branchName: execution.workBranch ?? null };
          },
        });

        if (dbDispatched) {
          launchOk = true;
          execution = patchTaskCursorExecution(execution, {
            status: "cursor_running",
            cursorRunId: dbDispatched.currentRun?.cursorAgentId ?? undefined,
            nowIso,
          });
        } else {
          const launch = await launchTaskCursorCloudAgent(apiRequest);
          launchOk = launch.ok;
          launchMessage = launch.ok ? undefined : launch.message;
          if (!launch.ok) {
            execution = patchTaskCursorExecution(execution, {
              status: "cursor_failed",
              failureReason: launch.reason,
              errorMessage: launch.message,
              nowIso,
            });
            timeline.push(buildTaskCursorApiFailedTimeline({ execution, nowIso }));
          } else {
            execution = patchTaskCursorExecution(execution, {
              status: "cursor_running",
              cursorRunId: launch.agentId,
              nowIso,
            });
          }
          await syncImplementationRuntimeFromTaskCursor({
            projectId,
            codeTaskId: body.codeTaskId,
            taskId,
            execution,
          });
        }
      } catch (error) {
        launchMessage = error instanceof Error ? error.message : String(error);
        execution = patchTaskCursorExecution(execution, {
          status: "cursor_failed",
          failureReason: "unknown",
          errorMessage: launchMessage,
          nowIso,
        });
        timeline.push(buildTaskCursorApiFailedTimeline({ execution, nowIso }));
      }
      const patch = buildTaskCursorOrchestrationPatch({
        execution,
        timelineEntries: [
          ...timeline,
          ...(launchOk && isServerTaskCursorPolling()
            ? [
                buildTaskCursorJobLifecycleTimelineEntry({
                  action: "task_cursor_job_created",
                  projectId,
                  taskId,
                  status: execution.status,
                  message: "server worker polling",
                  nowIso,
                }),
              ]
            : []),
        ],
        cursorWorkItems: scopedWorkItems,
      });
      let jobId: string | undefined;
      if (launchOk && isServerTaskCursorPolling()) {
        const job = await upsertTaskCursorExecutionJobFromLaunch({
          projectId,
          execution,
          workItems: scopedWorkItems,
        });
        jobId = job.id;
        await linkTaskCursorJobToImplementationRun({
          projectId,
          taskCursorJobId: job.id,
          codeTaskId: body.codeTaskId,
          now: new Date(nowIso),
        });
      }
      return NextResponse.json({
        success: launchOk,
        message: launchMessage,
        status: execution.status,
        execution: patch.taskCursorExecutionV1,
        orchestrationPatch: patch,
        executionMode: "task_cursor_job",
        pollRequired: launchOk && !isServerTaskCursorPolling(),
        serverPolling: launchOk && isServerTaskCursorPolling(),
        jobId,
      });
    }

    const apiResult = await executeTaskCursorApi(apiRequest);

    execution = applyTaskCursorApiResult({ execution, result: apiResult, nowIso });
    timeline.push(
      apiResult.ok
        ? buildTaskCursorApiCompletedTimeline({ execution, nowIso })
        : buildTaskCursorApiFailedTimeline({ execution, nowIso }),
    );

    let verifyGithub = body.verifyGithub !== false;
    if (execution.status === "cursor_completed" && verifyGithub) {
      execution = patchTaskCursorExecution(execution, { status: "github_verifying", nowIso });
      timeline.push(
        buildTaskCursorTimelineEntry({
          action: "task_cursor_github_verify_requested",
          projectId,
          taskId,
          status: "github_verifying",
          targetRepository: execution.targetRepository,
          baseBranch: execution.baseBranch,
          workBranch: execution.workBranch,
          commitSha: execution.commitSha,
          runId: execution.cursorRunId,
          nowIso,
        }),
      );
      const verify = await verifyTaskCursorGithubResult({
        execution,
        targetRepository: context.targetRepository,
        githubToken,
        allowedPathGlobs: context.allowedPathGlobs,
      });
      execution = applyTaskCursorGithubVerifyResult({
        execution,
        ok: verify.ok,
        message: verify.message,
        reason: verify.reason,
        verifiedChangedFiles: verify.verifiedChangedFiles,
        verifiedCommitSha: verify.verifiedCommitSha,
        nowIso,
      });
      if (execution.status === "github_verified") {
        execution = patchTaskCursorExecution(execution, { status: "review_pending", nowIso });
      }
      timeline.push(
        buildTaskCursorGithubVerifyTimeline({
          execution,
          ok: verify.ok,
          reason: verify.reason,
          nowIso,
        }),
      );
    }

    const patch = buildTaskCursorOrchestrationPatch({
      execution,
      timelineEntries: timeline,
      cursorWorkItems: scopedWorkItems,
    });

    const finalExecution = parseTaskCursorExecutionV1(patch.taskCursorExecutionV1);
    await syncImplementationRuntimeFromTaskCursor({
      projectId,
      codeTaskId: body.codeTaskId,
      taskId,
      execution: finalExecution,
    });
    return NextResponse.json({
      success: apiResult.ok,
      status: execution.status,
      result: apiResult,
      execution: patch.taskCursorExecutionV1,
      authRef: buildTaskCursorAuthRef({
        hasCursorToken: true,
        hasGithubAccessToken: true,
      }),
      orchestrationPatch: patch,
      executionMode: "task_cursor",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export { parseTaskCursorExecutionV1 };
