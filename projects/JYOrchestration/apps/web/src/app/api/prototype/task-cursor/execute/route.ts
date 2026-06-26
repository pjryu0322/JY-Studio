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
import {
  buildRuntimeSyncAfterLaunchTimelineEntry,
  syncCursorLaunchToDbRuntime,
} from "@/lib/prototype/taskCursorRuntimeSyncAfterLaunch";
import {
  buildTaskCursorWorkerTickScheduledTimeline,
  scheduleTaskCursorPollSoon,
} from "@/lib/prototype/taskCursorEmbeddedWorkerScheduler";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { syncImplementationRuntimeFromTaskCursor } from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";
import {
  findImplementationRunByTaskCursorJobId,
  linkTaskCursorJobToImplementationRun,
  syncRunPollScheduleFromJob,
} from "@/lib/runtime/implementationRuntime/implementationRuntimePollRepository";
import { TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS } from "@/lib/prototype/taskCursorExecutionJobRepository";
import { dispatchQueuedImplementationRuntimeRunWithCursor, resolveCodeTaskIdForDbRuntimeDispatch } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import {
  buildRuntimePromptQualityGateDiagnostics,
  CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE,
  logRuntimePromptQualityGateFailure,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import {
  buildRuntimePromptQualityGateTimelineEntry,
  patchTaskCursorExecutionForPromptPreflightFailure,
  PROMPT_PREFLIGHT_FAILED_PHASE,
} from "@/lib/prototype/codeTaskPromptPreflightFailure";
import {
  resolveRuntimeCodeTaskDeveloperPromptForExecute,
  type RuntimeDeveloperPromptSource,
} from "@/lib/prototype/resolveRuntimeCodeTaskDeveloperPromptForExecute";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { evaluateImplementationDatabaseRequiredExecutionBlock } from "@/lib/prototype/implementationPlanningDatabaseExecutionGuard";
import { prepareCodeTaskDeveloperPromptAugmentation } from "@/lib/project-knowledge/projectKnowledgeCodeTaskDeveloperPromptAugmentation";

type Body = {
  readonly projectId?: string;
  readonly taskId?: string;
  readonly codeTaskId?: string;
  readonly selectedWorkItemIds?: readonly string[];
  readonly workItems?: readonly CursorWorkItem[];
  readonly verifyGithub?: boolean;
  readonly launchOnly?: boolean;
  readonly developerPrompt?: string;
  readonly developerPromptFingerprint?: string;
  readonly promptSource?: string;
  readonly workBranch?: string;
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

    const projectRow = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true },
    });
    const requirementsState = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
    const databaseBlock = evaluateImplementationDatabaseRequiredExecutionBlock({
      planningHandoffForImplementationV1: requirementsState.planningHandoffForImplementationV1 ?? null,
    });
    if (databaseBlock.blocked) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          blocked: true,
          blockReason: databaseBlock.blockReason,
          message: databaseBlock.message,
          action: { type: "OPEN_PLANNING_DATABASE_SETTINGS", label: databaseBlock.actionLabel },
        },
        { status: 200 },
      );
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
    const codeTaskDeveloperPromptAugmentationPrepared = await prepareCodeTaskDeveloperPromptAugmentation({
      userId,
      targetProjectId: projectId,
    });
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

    const commitMessage = buildProviderWipCommitMessage("cursor", `task ${taskId}`, false, taskId);
    let apiRequest = {
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

    const codeTaskIdForPromptGate = String(body.codeTaskId ?? "").trim();
    let runtimePromptSource: RuntimeDeveloperPromptSource | null = null;
    let runtimePromptFingerprint: string | null = null;

    if (codeTaskIdForPromptGate) {
      const projectRow = await prisma.project.findUnique({
        where: { id: projectId },
        select: { requirementsStateJson: true },
      });
      const requirementsStateJson =
        parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
      const codeTaskWorkItemEarly = scopedWorkItems.find(
        (w) => String(w.codeTaskId ?? "").trim() === codeTaskIdForPromptGate,
      );
      const resolved = resolveRuntimeCodeTaskDeveloperPromptForExecute({
        projectId,
        codeTaskId: codeTaskIdForPromptGate,
        taskId,
        developerPrompt: body.developerPrompt,
        developerPromptFingerprint: body.developerPromptFingerprint,
        promptSource: body.promptSource,
        workBranch: body.workBranch,
        requirementsStateJson,
        targetRepository: context.targetRepository,
        baseBranch: context.baseBranch,
        allowedPathGlobs: context.allowedPathGlobs,
        scopedWorkItem: codeTaskWorkItemEarly ?? scopedWorkItems[0] ?? null,
        developerPromptAugmentation: codeTaskDeveloperPromptAugmentationPrepared.augmentation,
      });
      if (!resolved.ok) {
        const blockMessage =
          resolved.reason === "prompt_source_mismatch"
            ? "요청 prompt와 CodeTask 실행 정보가 일치하지 않습니다."
            : "Runtime developer prompt를 준비할 수 없어 실행을 차단했습니다.";
        const diagnostics = buildRuntimePromptQualityGateDiagnostics({
          codeTaskId: codeTaskIdForPromptGate,
          workBranch: buildCodeTaskWorkBranch(codeTaskIdForPromptGate),
          errors: resolved.errors,
          warnings: [],
        });
        logRuntimePromptQualityGateFailure(diagnostics);
        execution = patchTaskCursorExecutionForPromptPreflightFailure({
          execution: patchTaskCursorExecution(execution, {
            workBranch: buildCodeTaskWorkBranch(codeTaskIdForPromptGate),
            cursorPrompt: String(body.developerPrompt ?? "").trim() || undefined,
            nowIso,
          }),
          errorMessage: blockMessage,
          nowIso,
        });
        const orchestrationPatch = buildTaskCursorOrchestrationPatch({
          execution,
          timelineEntries: [
            buildRuntimePromptQualityGateTimelineEntry({
              projectId,
              codeTaskId: codeTaskIdForPromptGate,
              diagnostics,
              nowIso,
            }),
          ],
        });
        return NextResponse.json(
          {
            success: false,
            status: "blocked",
            message: blockMessage,
            phase: PROMPT_PREFLIGHT_FAILED_PHASE,
            failureReason: "prompt_preflight_failed",
            reason: resolved.reason,
            errors: resolved.errors,
            warnings: [],
            ...orchestrationPatch,
          },
          { status: 200 },
        );
      }
      runtimePromptSource = resolved.promptSource;
      runtimePromptFingerprint = resolved.fingerprint;
      execution = patchTaskCursorExecution(execution, {
        workBranch: resolved.workBranch,
        cursorPrompt: resolved.prompt,
        nowIso,
      });
      apiRequest = {
        ...apiRequest,
        prompt: resolved.prompt,
        workBranch: resolved.workBranch,
      };
    }

    if (codeTaskIdForPromptGate) {
      const allowedForSafety = resolveEffectiveAllowedPathGlobs({
        allowedPathGlobs: context.allowedPathGlobs,
        targetRepoFullName: context.targetRepository.repoFullName,
        targetRepoKind: "generated_project",
      });
      const codeTaskWorkItem = scopedWorkItems.find(
        (w) => String(w.codeTaskId ?? "").trim() === codeTaskIdForPromptGate,
      );
      const roleKind = codeTaskWorkItem
        ? resolveCodeTaskSpecificRole({
            codeTaskTitle: codeTaskWorkItem.title,
            codeTaskDescription: "",
            changeType: "component",
          }).roleKind
        : null;
      const expectedWorkBranch = buildCodeTaskWorkBranch(codeTaskIdForPromptGate);
      const promptSafety = validateCodeTaskDeveloperPromptSafety({
        prompt: apiRequest.prompt,
        targetRepoFullName: context.targetRepository.repoFullName,
        targetRepoKind: "generated_project",
        allowedPathGlobs: allowedForSafety,
        codeTaskId: codeTaskIdForPromptGate,
        workBranch: expectedWorkBranch,
        roleKind,
      });
      if (promptSafety.warnings.length > 0 && promptSafety.ok) {
        console.warn(
          "[runtime_prompt_quality_gate_warnings]",
          JSON.stringify({
            codeTaskId: codeTaskIdForPromptGate,
            workBranch: expectedWorkBranch,
            warnings: promptSafety.warnings,
          }),
        );
      }
      if (!promptSafety.ok) {
        const diagnostics = buildRuntimePromptQualityGateDiagnostics({
          codeTaskId: codeTaskIdForPromptGate,
          workBranch: expectedWorkBranch,
          errors: promptSafety.errors,
          warnings: promptSafety.warnings,
        });
        logRuntimePromptQualityGateFailure(diagnostics);
        console.warn(
          "[runtime_prompt_quality_gate_failed]",
          JSON.stringify({
            event: "runtime_prompt_quality_gate_failed",
            promptSource: runtimePromptSource,
            promptFingerprint: runtimePromptFingerprint,
            codeTaskId: codeTaskIdForPromptGate,
            workBranch: expectedWorkBranch,
            ok: false,
            errors: promptSafety.errors,
            warnings: promptSafety.warnings,
          }),
        );
        execution = patchTaskCursorExecutionForPromptPreflightFailure({
          execution,
          errorMessage: CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE,
          nowIso,
        });
        const preflightTimelineEntry = buildRuntimePromptQualityGateTimelineEntry({
          projectId,
          codeTaskId: codeTaskIdForPromptGate,
          diagnostics,
          nowIso,
        });
        const orchestrationPatch = buildTaskCursorOrchestrationPatch({
          execution,
          timelineEntries: [preflightTimelineEntry],
        });
        return NextResponse.json(
          {
            success: false,
            status: "blocked",
            message: CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE,
            phase: PROMPT_PREFLIGHT_FAILED_PHASE,
            failureReason: "prompt_preflight_failed",
            errors: promptSafety.errors,
            warnings: promptSafety.warnings,
            ...orchestrationPatch,
          },
          { status: 200 },
        );
      }
      console.info(
        "[runtime_prompt_quality_gate_checked]",
        JSON.stringify({
          event: "runtime_prompt_quality_gate_checked",
          promptSource: runtimePromptSource,
          promptFingerprint: runtimePromptFingerprint,
          codeTaskId: codeTaskIdForPromptGate,
          workBranch: expectedWorkBranch,
          ok: true,
          errors: [],
          warnings: promptSafety.warnings,
        }),
      );
    }

    execution = patchTaskCursorExecution(execution, { status: "cursor_requested", nowIso });
    const timeline = [
      ...buildTaskCursorRequestedTimeline({ execution, nowIso }),
      buildTaskCursorApiStartedTimeline({ execution, nowIso }),
    ];
    execution = patchTaskCursorExecution(execution, { status: "cursor_running", nowIso });

    if (useCloudAgentLaunch) {
      const bundleForDispatch = await getImplementationRuntimeBundle(projectId);
      const codeTaskIdForRuntime = resolveCodeTaskIdForDbRuntimeDispatch({
        requestedCodeTaskId: String(body.codeTaskId ?? taskId).trim(),
        bundle: bundleForDispatch,
      });
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
            return {
              agentId: launch.agentId,
              branchName: execution.workBranch ?? null,
              targetRepository: context.targetRepository,
              baseBranch: context.baseBranch,
            };
          },
        });

        if (!dbDispatched) {
          const bundle = await getImplementationRuntimeBundle(projectId);
          const message =
            bundle.job?.status === "running"
              ? "DB Queue dispatch 없이 Cursor Agent를 실행할 수 없습니다. 구현 Runtime Job/Queue 상태를 확인한 뒤 다시 시도해 주세요."
              : "구현 Runtime Job이 없습니다. [선택한 CodeTask 실행]으로 다시 시작해 주세요.";
          launchOk = false;
          launchMessage = message;
          execution = patchTaskCursorExecution(execution, {
            status: "cursor_failed",
            failureReason: "dispatch_blocked",
            errorMessage: message,
            nowIso,
          });
          timeline.push(buildTaskCursorApiFailedTimeline({ execution, nowIso }));
        } else {
          launchOk = true;
          const agentId =
            String(dbDispatched.currentRun?.cursorAgentId ?? execution.cursorRunId ?? "").trim();
          execution = patchTaskCursorExecution(execution, {
            status: "cursor_running",
            cursorRunId: agentId || undefined,
            nowIso,
          });
          if (agentId) {
            await syncCursorLaunchToDbRuntime({
              projectId,
              codeTaskId: codeTaskIdForRuntime,
              taskId,
              execution,
              agentId,
              targetRepository: context.targetRepository,
              baseBranch: context.baseBranch,
              workBranch: execution.workBranch ?? null,
              now: new Date(nowIso),
            });
            timeline.push(
              buildRuntimeSyncAfterLaunchTimelineEntry({
                projectId,
                taskId,
                codeTaskId: codeTaskIdForRuntime,
                agentId,
                nowIso,
              }),
            );
          }
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
      if (launchOk && isServerTaskCursorPolling()) {
        timeline.push(
          buildTaskCursorJobLifecycleTimelineEntry({
            action: "task_cursor_job_created",
            projectId,
            taskId,
            status: execution.status,
            message: "embedded worker polling",
            nowIso,
          }),
        );
      }
      let jobId: string | undefined;
      if (launchOk && isServerTaskCursorPolling()) {
        const job = await upsertTaskCursorExecutionJobFromLaunch({
          projectId,
          execution,
          workItems: scopedWorkItems,
          codeTaskId: codeTaskIdForRuntime,
        });
        jobId = job.id;
        await linkTaskCursorJobToImplementationRun({
          projectId,
          taskCursorJobId: job.id,
          codeTaskId: codeTaskIdForRuntime,
          now: new Date(nowIso),
        });
        await syncImplementationRuntimeFromTaskCursor({
          projectId,
          codeTaskId: body.codeTaskId,
          taskId,
          execution,
        });
        const linkedRun = await findImplementationRunByTaskCursorJobId(job.id);
        if (linkedRun) {
          const pollAt = new Date(nowIso);
          await syncRunPollScheduleFromJob({
            runId: linkedRun.id,
            pollCount: job.pollCount ?? 0,
            lastPollAt: pollAt,
            nextPollAt: new Date(pollAt.getTime() + TASK_CURSOR_JOB_DEFAULT_POLL_DELAY_MS),
            terminal: false,
          });
        }
        timeline.push(
          buildTaskCursorWorkerTickScheduledTimeline({
            projectId,
            taskId,
            jobId: job.id,
            nowIso,
          }),
        );
        scheduleTaskCursorPollSoon({ projectId, delayMs: 400 });
      }
      const orchestrationPatch = buildTaskCursorOrchestrationPatch({
        execution,
        timelineEntries: timeline,
        cursorWorkItems: scopedWorkItems,
      });
      return NextResponse.json({
        success: launchOk,
        message: launchMessage,
        status: execution.status,
        execution: orchestrationPatch.taskCursorExecutionV1,
        orchestrationPatch,
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
