import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { buildCursorExecutionPrompt } from "@/lib/execution/buildCursorExecutionPrompt";
import {
  executeCursorRun,
  type CursorRunResult,
  type ExecuteCursorRunOutcome,
} from "@/lib/execution/cursorExecutionAdapter";
import { isCursorCodeReflectionConfirmed } from "@/lib/execution/cursorReflectionPolicy";
import { evaluateExecutionResult } from "@/lib/execution/evaluateTaskExecution";
import { countExecutionReviewAiMembers } from "@/lib/execution/executionReviewWithAiMembers";
import { taskLooksSensitive } from "@/lib/execution/taskSensitivity";
import { computeExecutionBranchPlan } from "@/lib/execution/branchPolicy";
import { assertGitRepoUrlConfiguredForRun } from "@/lib/execution/repoUrlPolicy";
import { isExecutionLoopPaused, setExecutionLoopPaused } from "@/lib/executionLoop/loopControllerState";
import { parseCriteria, parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import {
  initializeLoopParticipants,
  loadWorkflowGraphTasks,
  refreshWorkflowStates,
  updateTaskOrchestrationSnapshot,
} from "@/lib/executionLoop/workflowState";
import { reclaimStaleRunningWorkflowTasks } from "@/lib/executionLoop/staleRunningRecovery";
import { pickNextReadyTask, type TaskForPick } from "./pickNextReadyTask";
import type { LoopStepRecord, RunExecutionLoopResult } from "./runLoopTypes";
import { EXECUTION_WORKFLOW } from "./workflowConstants";
import { normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { ensureTaskExecutionRunColumnsReady } from "@/lib/prisma/taskExecutionRunColumnsHeal";
import { appendTaskProgressLog } from "@/lib/observability/taskProgressLog";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import { autoMergePullRequest, isAutoMergeEnabled } from "@/lib/service/githubAutoMergeService";
import { fetchGithubCompareSnapshot } from "@/lib/service/githubCompareService";
import { countScmManagerAiMembers, tryRunScmManagerWithAiMembers } from "@/lib/execution/scmManagerWithAiMembers";
import {
  runEnvTestAfterGithubPushConfirmed,
  runEnvTestPlatformPrPhase,
} from "@/lib/executionLoop/envTestExecutionHelpers";
import {
  evaluateNextTaskReadiness,
  type NextTaskReadinessResult,
} from "@/lib/executionLoop/nextTaskReadiness";
import { createGithubPullRequestFromBranch } from "@/lib/service/githubPullRequestFromBranchService";
import { findOpenPullRequestByHeadBranch } from "@/lib/service/githubOpenPullRequestByHeadService";
import { GITHUB_REST_MISSING_TOKEN_USER_MESSAGE } from "@/lib/integration/githubRestCommon";
import { executeEnvTestPrMergeSmokeTest } from "@/lib/service/environmentTestMergeService";

export type { LoopStepRecord, RunExecutionLoopResult } from "./runLoopTypes";

const loopLocks = new Set<string>();

function isCursorRunSuccessWithResult(
  o: ExecuteCursorRunOutcome
): o is { ok: true; result: CursorRunResult; logs: string[] } {
  return Boolean(o.ok && "result" in o);
}

function parsePrNumberFromUrl(prUrl: string): number | null {
  const m = String(prUrl).match(/\/pull\/(\d+)(?:\/|$)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 실행 루프: Cursor 실행 → Git 반영(Cursor 위임) → (AI 리뷰어 있으면) 멀티 리뷰 → 전이. 리뷰어 없으면 리뷰 단계 생략.
 * 플랫폼은 로컬에서 코드/git을 실행하지 않습니다.
 */
export async function runExecutionLoop(params: {
  projectId: string;
  actorUserId: string;
  singleTaskId?: string;
}): Promise<RunExecutionLoopResult> {
  const { projectId, actorUserId, singleTaskId } = params;
  const steps: LoopStepRecord[] = [];

  if (loopLocks.has(projectId)) {
    return { ok: false, steps, message: "이 프로젝트에서 실행 루프가 이미 동작 중입니다." };
  }
  loopLocks.add(projectId);

  try {
    await ensureTaskExecutionRunColumnsReady();

    const stubCursor = process.env.EXECUTION_LOOP_STUB_CURSOR === "1";
    appendTaskProgressLog({
      kind: "execution",
      phase: "loop_start",
      projectId,
      userId: actorUserId,
      detail: { singleTaskId: singleTaskId ?? null, stubCursor },
    });
    console.info("[execution-loop] start", {
      projectId,
      actorUserId,
      singleTaskId: singleTaskId ?? null,
      stubCursor,
    });

    const setup = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.findUnique({ where: { projectId } })
    );
    if (!setup) {
      return { ok: false, steps, message: "Execution setup 이 없습니다." };
    }
    if (String(setup.status) !== "validated") {
      return {
        ok: false,
        steps,
        message:
          "저장소 연결 검증과 Cursor 저장소 접근 검증을 모두 통과해야 실행할 수 있습니다. Git 연동·실행 환경 설정에서 검증을 완료하세요. (Execution setup 상태: validated)",
      };
    }
    if (setup.projectId !== projectId) {
      return { ok: false, steps, message: "Execution setup 프로젝트 불일치." };
    }

    try {
      assertGitRepoUrlConfiguredForRun(setup.gitRepoUrl);
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        steps,
        message:
          code === "GIT_REPO_URL_REQUIRED"
            ? "Git 저장소 URL(gitRepoUrl)이 필요합니다."
            : "Git 저장소 URL이 올바르지 않습니다.",
      };
    }

    const cursorConfigured = stubCursor || Boolean(String(setup.cursorApiToken ?? "").trim());
    if (!cursorConfigured) {
      return {
        ok: false,
        steps,
        message:
          "Cursor executor is required. 실행 환경 설정에 Cursor API 키를 저장하고 Cursor 저장소 접근 검증을 완료하세요.",
      };
    }

    const maxRetries = Math.max(0, setup.maxAutoRetriesPerTask ?? 2);
    const autoAdvance = setup.autoAdvanceToNextTask !== false;
    const stopOnTestFailure = setup.stopOnTestFailure !== false;
    const stopOnRepeatedFailure = setup.stopOnRepeatedFailure !== false;
    const stopOnOutOfScopeChange = setup.stopOnOutOfScopeChange !== false;
    const requireApprovalForSensitiveTasks = setup.requireApprovalForSensitiveTasks === true;

    const executionReviewerCount = await countExecutionReviewAiMembers(projectId);
    const noExecutionReviewers = executionReviewerCount === 0;
    const effectiveAutoAdvance = noExecutionReviewers ? true : autoAdvance;
    const effectiveRequireApprovalForSensitive = noExecutionReviewers ? false : requireApprovalForSensitiveTasks;
    if (noExecutionReviewers) {
      console.info(
        "[execution-loop] AI execution-review 멤버 없음: 자동 진행 강제, 민감 작업 승인 게이트 비활성(리뷰어 없음 모드)"
      );
    }
    const allowedGlobs = parseStringArrayJson(setup.allowedPathGlobs);
    const repoUrl = setup.gitRepoUrl.trim();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, currentSpecVersionId: true },
    });
    if (!project?.currentSpecVersionId) {
      return {
        ok: false,
        steps,
        message: "확정된 Project Spec 버전이 없습니다. Spec을 확정한 뒤 Task를 생성·확정하고 실행하세요.",
      };
    }
    const projectName = project?.name ?? projectId;

    await initializeLoopParticipants(projectId);

    if (singleTaskId) {
      const forcedHead = await prisma.task.findUnique({
        where: { id: singleTaskId },
        select: { taskKind: true, projectId: true },
      });
      if (
        forcedHead?.projectId === projectId &&
        String(forcedHead.taskKind ?? "").trim() === "ENV_TEST"
      ) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_push_policy_check_started",
          projectId,
          userId: actorUserId,
          detail: { context: "execution_loop_gate" },
        });
        const baseTrim = String(setup.baseBranch ?? "").trim();
        if (!baseTrim) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "env_test_base_branch_missing",
            projectId,
            userId: actorUserId,
            detail: { reasonCode: "BASE_BRANCH_MISSING", context: "execution_loop_gate" },
          });
          return {
            ok: false,
            steps,
            message: "기본 브랜치 설정이 없어 ENV_TEST를 진행할 수 없습니다",
          };
        }
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_base_branch_resolved",
          projectId,
          userId: actorUserId,
          detail: { baseBranch: baseTrim, context: "execution_loop_gate" },
        });
        if (setup.autoPush !== true) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "env_test_push_policy_blocked",
            projectId,
            userId: actorUserId,
            detail: { reasonCode: "AUTO_PUSH_OFF", context: "execution_loop_gate" },
          });
          return {
            ok: false,
            steps,
            message: "ENV_TEST는 Push 가능한 실행 정책에서만 실행할 수 있습니다",
          };
        }
      }
    }

    await reclaimStaleRunningWorkflowTasks(projectId);

    const firstRow = (await loadWorkflowGraphTasks(projectId))[0];
    if (firstRow) {
      await appendTaskHistory({
        projectId,
        taskId: firstRow.id,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: actorUserId,
        eventType: TaskHistoryEventType.EXECUTION_LOOP_STARTED,
        summary: singleTaskId ? "단일 Task 실행 (Cursor API)" : "실행 루프 시작 (Cursor API)",
        detailJson: { projectId, singleTaskId, mode: "cursor_api" },
      });
    }

    let lastTaskId = "";
    let lastTaskSetKey = "";

    while (true) {
      if (isExecutionLoopPaused(projectId)) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "loop_stop",
          projectId,
          userId: actorUserId,
          detail: { reason: "paused" },
        });
        steps.push({ phase: "stop", reason: "paused" });
        return { ok: true, steps, message: "실행 루프가 일시정지 상태입니다." };
      }

      let rows = await loadWorkflowGraphTasks(projectId);
      const taskSetKey = rows.map((r) => r.id).join("|");
      const needsWorkflowResync = taskSetKey !== lastTaskSetKey || rows.some((r) => r.executionWorkflowStatus == null);
      if (needsWorkflowResync) {
        console.log("[execution-loop] tasks selected:", rows.length);
        console.log("[execution-loop] specVersion:", project.currentSpecVersionId);
        await refreshWorkflowStates(projectId);
        // 리프레시 이후 새로 READY로 전이된 Task 정보를 다시 로드한다.
        rows = await loadWorkflowGraphTasks(projectId);
        lastTaskSetKey = taskSetKey;
      }

      if (!singleTaskId) {
        const blockedByReflection = rows.some((r) => r.executionWorkflowStatus === EXECUTION_WORKFLOW.PENDING_APPLY);
        const blockedByReviewOrMerge = rows.some((r) => {
          const s = String(r.executionWorkflowStatus ?? "").trim();
          return (
            s === EXECUTION_WORKFLOW.COMMITTED ||
            s === EXECUTION_WORKFLOW.REVIEW_PENDING ||
            s === EXECUTION_WORKFLOW.REVIEW_REJECTED ||
            s === EXECUTION_WORKFLOW.REVIEW_APPROVED ||
            s === EXECUTION_WORKFLOW.MERGE_PENDING
          );
        });
        if (blockedByReflection || blockedByReviewOrMerge) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "loop_stop",
            projectId,
            userId: actorUserId,
            detail: { reason: blockedByReflection ? "pending_git_reflection_blocks_loop" : "review_or_merge_blocks_loop" },
          });
          steps.push({ phase: "stop", reason: "pending_git_reflection_blocks_loop" });
          return {
            ok: true,
            steps,
            message:
              blockedByReflection
                ? "Git 반영이 확인되지 않은 Task가 있어 자동 진행을 멈췄습니다. 상세 보기의 실행 기록을 확인하거나, 해당 Task ID로 단일 실행을 다시 시도하세요."
                : "리뷰/머지 대기 상태의 Task가 있어 자동 진행을 멈췄습니다. 먼저 해당 Task를 리뷰/머지 완료하세요.",
          };
        }
      }

      const todoRows = rows.filter((r) => r.status === "TODO");
      if (todoRows.length === 0) {
        steps.push({ phase: "stop", reason: "no_todo_tasks" });
        const anchorId = (rows[0]?.id ?? lastTaskId).trim();
        if (anchorId) {
          await appendTaskHistory({
            projectId,
            taskId: anchorId,
            actorType: TaskHistoryActorType.SYSTEM,
            actorId: actorUserId,
            eventType: TaskHistoryEventType.EXECUTION_LOOP_FINISHED,
            summary: "TODO Task 없음 — 루프 종료",
            detailJson: {},
          }).catch(() => {});
        }
        const msg =
          rows.length === 0
            ? "실행 루프 대상 Task가 없습니다. 워크스페이스에서 Task를 확정했는지, 상태가 취소·차단(BLOCKED/CANCELLED)이 아닌지 확인하세요."
            : "실행할 TODO Task가 없습니다. 이미 완료되었거나 IN_PROGRESS 등 다른 상태일 수 있습니다.";
        return { ok: true, steps, message: msg };
      }

      const pickRows: TaskForPick[] = rows.map((r) => ({
        id: r.id,
        order: r.order,
        status: r.status,
        dependsOnTaskIds: r.dependsOnTaskIds,
        executionWorkflowStatus: r.executionWorkflowStatus,
        taskKind: r.taskKind,
      }));

      let next = pickNextReadyTask(pickRows);
      if (singleTaskId) {
        const forced = rows.find((r) => r.id === singleTaskId);
        if (!forced || forced.status !== "TODO") {
          return { ok: false, steps, message: "지정한 Task를 찾을 수 없거나 TODO가 아닙니다." };
        }
        if (
          forced.executionWorkflowStatus !== EXECUTION_WORKFLOW.READY &&
          forced.executionWorkflowStatus !== EXECUTION_WORKFLOW.PENDING_APPLY
        ) {
          return {
            ok: false,
            steps,
            message:
              "지정한 Task가 ready 또는 Git 반영 대기(pending_apply) 상태가 아닙니다. 선행 Task를 완료하세요.",
          };
        }
        next = forced;
      }

      if (!next) {
        const anyFailed = rows.some((r) => r.executionWorkflowStatus === EXECUTION_WORKFLOW.FAILED);
        steps.push({ phase: "stop", reason: anyFailed ? "blocked_or_failed" : "all_done_or_waiting" });
        const tid = rows[0]?.id ?? lastTaskId;
        if (tid) {
          await appendTaskHistory({
            projectId,
            taskId: tid,
            actorType: TaskHistoryActorType.SYSTEM,
            actorId: actorUserId,
            eventType: TaskHistoryEventType.EXECUTION_LOOP_FINISHED,
            summary: anyFailed ? "루프 중단(failed)" : "루프 종료",
            detailJson: { reason: anyFailed ? "failed" : "complete" },
          }).catch(() => {});
        }
        return {
          ok: !anyFailed,
          steps,
          message: anyFailed ? "실행 루프가 실패 상태로 중단되었습니다." : "실행 루프가 완료되었습니다.",
        };
      }

      const taskId = next.id;
      lastTaskId = taskId;
      steps.push({ phase: "picked", taskId });

      await prisma.task.update({
        where: { id: taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.RUNNING,
          lastLoopRunAt: new Date(),
        },
      });

      const taskRow = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          name: true,
          description: true,
          loopRetryCount: true,
          acceptanceCriteria: true,
          sourceSpecVersionId: true,
          taskKind: true,
        },
      });
      if (!taskRow) {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.READY,
            lastEvalSummary: "Task 행을 찾을 수 없어 running 상태를 해제했습니다.",
          },
        });
        await refreshWorkflowStates(projectId);
        continue;
      }

      /** 이후 분기 기준: true면 ENV_TEST 전용 헬퍼·로그·브랜치, false면 일반 Task 폴링/PR 경로만. */
      const isEnvTestTask = String(taskRow.taskKind ?? "").trim() === "ENV_TEST";

      appendTaskProgressLog({
        kind: "execution",
        phase: "task_picked",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { taskName: taskRow.name },
      });

      if (isEnvTestTask) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_started",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { taskName: taskRow.name, taskKind: "ENV_TEST" },
        });
      }

      const criteria = parseCriteria(taskRow.acceptanceCriteria);

      const mergedAllowedGlobs =
        isEnvTestTask && !allowedGlobs.includes("orchestration-test/**")
          ? ["orchestration-test/**", ...allowedGlobs]
          : allowedGlobs;

      const branchPlan = computeExecutionBranchPlan({
        branchStrategy: setup.branchStrategy,
        branchPrefix: setup.branchPrefix,
        projectId,
        taskId: taskRow.id,
        taskTitle: taskRow.name,
        baseBranch: setup.baseBranch,
        taskKind: taskRow.taskKind,
      });

      if (isEnvTestTask) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_branch_assigned",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { branchName: branchPlan.branchName },
        });
      }

      const prompt = buildCursorExecutionPrompt(
        {
          id: taskRow.id,
          title: taskRow.name,
          description: taskRow.description,
          acceptanceCriteria: criteria,
        },
        { id: projectId, name: projectName },
        {
          gitRepoUrl: setup.gitRepoUrl.trim(),
          baseBranch: setup.baseBranch,
          branchStrategy: setup.branchStrategy,
          suggestedBranchName: branchPlan.branchName,
          autoCommit: setup.autoCommit !== false,
          autoPush: setup.autoPush === true,
          requireTestsBeforePush: setup.requireTestsBeforePush !== false,
          allowedPathGlobs: mergedAllowedGlobs,
        }
      );

      // 동일 Task에 아직 active한 실행(run)이 남아 있으면 재실행을 막는다.
      const existingActiveRun = await prisma.taskExecutionRun.findFirst({
        where: {
          projectId,
          taskId,
          status: { in: ["running", "awaiting_git_reflection", "reviewing"] },
          archivedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      if (existingActiveRun) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "repick_blocked_existing_active_run",
          projectId,
          taskId,
          userId: actorUserId,
          detail: {
            existingRunId: existingActiveRun.id,
            existingStatus: existingActiveRun.status,
            branch: existingActiveRun.branchName ?? null,
            singleTaskId: singleTaskId ?? null,
          },
        });
        steps.push({
          phase: "stop",
          reason: "existing_active_run",
        });
        const blockedMsg =
          singleTaskId && isEnvTestTask
            ? `연결 테스트를 시작할 수 없습니다. 이전 실행이 아직 끝나지 않았습니다(상태: ${existingActiveRun.status}). 잠시 후 다시 시도하세요.`
            : singleTaskId
              ? `이 Task에 대해 아직 진행 중인 실행이 있습니다(상태: ${existingActiveRun.status}). 끝난 뒤 다시 실행하세요.`
              : "이 Task에 대해 아직 진행 중인 실행이 있습니다. 해당 실행이 끝난 뒤 다시 루프를 실행하세요.";
        return {
          ok: singleTaskId ? false : true,
          steps,
          message: blockedMsg,
        };
      }

      const execRun = await prisma.taskExecutionRun.create({
        data: {
          projectId,
          taskId,
          status: "running",
          branchName: branchPlan.branchName,
          promptSnapshot: prompt.slice(0, 120_000),
          retryCount: taskRow.loopRetryCount ?? 0,
          workflowId: taskRow.sourceSpecVersionId ?? null,
          provider: "cursor",
          repoUrlSnapshot: repoUrl,
        },
      });

      console.info("[execution-loop] cursor invoke", {
        projectId,
        taskId,
        branch: branchPlan.branchName,
        runRecordId: execRun.id,
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "cursor_invoke",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { branch: branchPlan.branchName, runRecordId: execRun.id },
      });

      // 실행 스코프(ENV_TEST vs 일반 Task) — 로그로 경로 구분.
      appendTaskProgressLog({
        kind: "execution",
        phase: "execution_scope_selected",
        projectId,
        taskId,
        userId: actorUserId,
        detail: {
          scope: isEnvTestTask ? "ENV_TEST" : "NORMAL_TASK",
          taskKind: taskRow.taskKind ?? null,
        },
      });
      if (!isEnvTestTask) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "normal_task_scope_guard_passed",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { taskKind: taskRow.taskKind ?? null },
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_finalize_context_skipped",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { reason: "NORMAL_TASK", taskKind: taskRow.taskKind ?? null },
        });
      }

      let cursorOutcome: ExecuteCursorRunOutcome;
      try {
        if (isEnvTestTask) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "env_test_cursor_invoke_started",
            projectId,
            taskId,
            userId: actorUserId,
            detail: { execRunId: execRun.id, branch: branchPlan.branchName },
          });
        }
        cursorOutcome = await executeCursorRun({
          projectId,
          workflowId: taskRow.sourceSpecVersionId ?? null,
          executionSetup: {
            cursorApiUrl: normalizeCursorApiBaseUrl(setup.cursorApiUrl),
            cursorApiToken: setup.cursorApiToken ?? null,
            gitRepoUrl: repoUrl,
            baseBranch: setup.baseBranch,
            branchStrategy: setup.branchStrategy,
            branchPrefix: setup.branchPrefix,
            autoCommit: setup.autoCommit !== false,
            autoPush: setup.autoPush === true,
            autoPr: setup.autoPr === true,
            requireTestsBeforePush: setup.requireTestsBeforePush !== false,
          },
          task: {
            id: taskRow.id,
            title: taskRow.name,
            description: taskRow.description,
            acceptanceCriteria: criteria,
          },
          suggestedBranchName: branchPlan.branchName,
          prompt,
          allowedPaths: mergedAllowedGlobs.length ? mergedAllowedGlobs : undefined,
          taskKind: taskRow.taskKind ?? null,
          githubAccessToken: setup.githubAccessToken ?? null,
          envTestPollFinalizeContext: isEnvTestTask
            ? {
                execRunId: execRun.id,
                actorUserId,
                taskId,
                repoUrl,
                baseBranch: setup.baseBranch,
                githubAccessToken: setup.githubAccessToken ?? null,
                steps,
                singleTaskId,
                effectiveAutoAdvance,
                execRunCreatedAt: execRun.createdAt,
              }
            : undefined,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[execution-loop] cursor threw (abnormal)", { taskId, errMsg });
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_abnormal",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { message: errMsg.slice(0, 2000) },
        });
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: {
            status: "failed",
            runError: errMsg.slice(0, 8000),
            evaluationDecision: "failed",
            evaluationReason: `cursor_exception: ${errMsg.slice(0, 2000)}`,
          },
        });
        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.READY,
            lastEvalResult: "retry",
            lastEvalSummary: `Cursor 단계 예외로 중단: ${errMsg.slice(0, 1500)}`,
          },
        });
        await updateTaskOrchestrationSnapshot(taskId, {
          branch: branchPlan.branchName,
          commitStatus: "failed",
          pushStatus: "n/a",
        });
        await refreshWorkflowStates(projectId);
        steps.push({ phase: "cursor", taskId, ok: false, error: errMsg });
        if (singleTaskId) {
          return { ok: false, steps, message: errMsg };
        }
        if (!effectiveAutoAdvance) {
          return { ok: false, steps, message: errMsg };
        }
        continue;
      }

      if (
        isEnvTestTask &&
        cursorOutcome.ok &&
        "envTestGithubEarlyFinished" in cursorOutcome &&
        cursorOutcome.envTestGithubEarlyFinished
      ) {
        if (cursorOutcome.envTestFinalizeOutcome.kind === "continue_loop") {
          continue;
        }
        return cursorOutcome.envTestFinalizeOutcome.result;
      }

      steps.push({
        phase: "cursor",
        taskId,
        ok: cursorOutcome.ok,
        runId: isCursorRunSuccessWithResult(cursorOutcome) ? cursorOutcome.result.runId : undefined,
        error: cursorOutcome.ok ? undefined : cursorOutcome.error,
      });

      if (isCursorRunSuccessWithResult(cursorOutcome)) {
        const cr0 = cursorOutcome.result;
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_terminal",
          projectId,
          taskId,
          userId: actorUserId,
          detail: {
            runId: cr0.runId,
            branch: cr0.branchName,
            commitHash: cr0.commitHash ?? null,
            changedFileCount: cr0.changedFiles.length,
            executionStatus: cr0.executionStatus,
          },
        });
        console.info("[execution-loop] cursor agent terminal (Git 반영은 별도 게이트에서 검증)", {
          taskId,
          runId: cr0.runId,
          branch: cr0.branchName,
          commitHash: cr0.commitHash ?? null,
          changedFiles: cr0.changedFiles.length,
          executionStatus: cr0.executionStatus,
        });
        if (isEnvTestTask) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "env_test_cursor_invoke_succeeded",
            projectId,
            taskId,
            userId: actorUserId,
            detail: { runId: cr0.runId, branch: cr0.branchName },
          });
        }
      } else if (!cursorOutcome.ok) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "cursor_failed",
          projectId,
          taskId,
          userId: actorUserId,
          detail: {
            error: (cursorOutcome.error ?? "").slice(0, 2000),
            logTail: cursorOutcome.logs?.slice(-8),
          },
        });
        console.error("[execution-loop] cursor failed", {
          taskId,
          error: cursorOutcome.error,
          logTail: cursorOutcome.logs?.slice(-5),
        });
      }

      if (!cursorOutcome.ok) {
        const errMsg = cursorOutcome.error ?? "cursor failed";

        // PR도 없고 Cursor도 터미널을 못 내고 끝난 경우(특히 timeout)는 즉시 FAILED로 정리해 무한 재시도를 막는다.
        const isTimeout =
          errMsg.includes("응답 시간 초과") || errMsg.toLowerCase().includes("timeout");
        if (isTimeout) {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
              lastEvalResult: "failed",
              lastEvalSummary: `Cursor agent timeout(5m) + PR 미발견: ${errMsg}`.slice(0, 1500),
            },
          });
          await prisma.taskExecutionRun.update({
            where: { id: execRun.id },
            data: { status: "failed", evaluationDecision: "failed", evaluationReason: `timeout_no_pr:${errMsg}`.slice(0, 8000) },
          });
          await refreshWorkflowStates(projectId);
          if (singleTaskId) {
            return { ok: false, steps, message: "Cursor agent timeout + PR 미발견으로 실패 처리했습니다." };
          }
          // autoAdvance 상황에서도 해당 Task는 FAILED가 되었으니 다음 READY가 있으면 진행된다.
          continue;
        }

        const priorErrRun = await prisma.taskExecutionRun.findFirst({
          where: { taskId, id: { not: execRun.id }, runError: errMsg },
          orderBy: { createdAt: "desc" },
        });
        const repeatedCursor = stopOnRepeatedFailure && priorErrRun !== null;

        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { runError: errMsg.slice(0, 8000) },
        });

        const cur = taskRow.loopRetryCount ?? 0;
        if (cur >= maxRetries || repeatedCursor) {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
              lastEvalResult: "failed",
              lastEvalSummary: repeatedCursor
                ? `동일 Cursor 오류 반복(stopOnRepeatedFailure): ${errMsg}`
                : errMsg,
            },
          });
          await prisma.taskExecutionRun.update({
            where: { id: execRun.id },
            data: {
              status: "failed",
              evaluationDecision: "failed",
              evaluationReason: repeatedCursor
                ? `repeated_cursor_error: ${errMsg}`
                : errMsg,
            },
          });
          await updateTaskOrchestrationSnapshot(taskId, {
            branch: branchPlan.branchName,
            commitStatus: "failed",
            pushStatus: "n/a",
          });
          if (singleTaskId) break;
          break;
        }
        await prisma.task.update({
          where: { id: taskId },
          data: {
            loopRetryCount: cur + 1,
            executionWorkflowStatus: EXECUTION_WORKFLOW.READY,
            lastEvalResult: "retry",
            lastEvalSummary: errMsg,
          },
        });
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { status: "retry_needed", evaluationReason: errMsg, evaluationDecision: "retry" },
        });
        await refreshWorkflowStates(projectId);
        if (singleTaskId) break;
        if (!effectiveAutoAdvance) break;
        continue;
      }

      if (!cursorOutcome.ok) {
        // 위에서 처리되지 않은 실패 케이스는 여기서 방어적으로 중단한다.
        break;
      }

      if (!isCursorRunSuccessWithResult(cursorOutcome)) {
        break;
      }
      const { result: cr } = cursorOutcome;

      const reflectionOk = isCursorCodeReflectionConfirmed(cr);
      if (!reflectionOk) {
        const headPending = (cr.branchName || branchPlan.branchName || "").trim();
        if (isEnvTestTask && headPending) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "env_test_branch_reflection_check_started",
            projectId,
            taskId,
            userId: actorUserId,
            detail: { base: setup.baseBranch, head: headPending, step: "reflection_bypass" },
          });
          const comparePa = await fetchGithubCompareSnapshot({
            repoUrl,
            base: setup.baseBranch,
            head: headPending,
            maxFiles: 80,
            githubAccessToken: setup.githubAccessToken ?? null,
            projectId,
            allowUnauthenticated: true,
          });
          if (comparePa.ok && comparePa.data.aheadBy > 0) {
            appendTaskProgressLog({
              kind: "execution",
              phase: "env_test_branch_reflection_confirmed",
              projectId,
              taskId,
              userId: actorUserId,
              detail: {
                aheadBy: comparePa.data.aheadBy,
                headSha: comparePa.data.headSha ?? null,
                step: "reflection_bypass",
              },
            });
            steps.push({
              phase: "git_reflection_gate",
              taskId,
              runId: cr.runId,
              branch: headPending,
              commitHash: cr.commitHash ?? null,
              changedFileCount: cr.changedFiles.length,
              passed: true,
              reason: "github_compare_ahead_by",
            });
            const outPa = await runEnvTestAfterGithubPushConfirmed({
              projectId,
              taskId,
              taskKind: taskRow.taskKind,
              execRunId: execRun.id,
              actorUserId,
              branchName: headPending,
              repoUrl,
              baseBranch: setup.baseBranch,
              githubAccessToken: setup.githubAccessToken ?? null,
              compareData: {
                headSha: comparePa.data.headSha ?? cr.commitHash ?? null,
                changedFiles: comparePa.data.changedFiles,
                diffSummary: comparePa.data.diffSummary,
              },
              steps,
              singleTaskId,
              effectiveAutoAdvance,
              cursorRunId: cr.runId,
              cursorSummary: cr.summary,
              via: "reflection_bypass",
              pushDetectedSource: "reflection_bypass_compare",
              executionRunCreatedAt: execRun.createdAt,
            });
            if (outPa.kind === "return") {
              return outPa.result;
            }
            if (outPa.kind === "continue_loop") {
              continue;
            }
          }
          if (!comparePa.ok && comparePa.code === "GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS") {
            appendTaskProgressLog({
              kind: "execution",
              phase: "github_compare_missing_token",
              projectId,
              taskId,
              userId: actorUserId,
              detail: { context: "git_reflection_gate_env_test", branchName: headPending, baseBranch: setup.baseBranch },
            });
            appendTaskProgressLog({
              kind: "execution",
              phase: "git_reflection_gate_blocked_no_token",
              projectId,
              taskId,
              userId: actorUserId,
              detail: { branchName: headPending, baseBranch: setup.baseBranch, gateReason: "github_compare_unavailable_no_token" },
            });
          }
          // ENV_TEST: 토큰 부재로 GitHub compare를 못 돌리면, 기존 no_commit_and_no_changed_files로 뭉개지 않고
          // 명확한 게이트 reason으로 pending_apply 처리한다.
          if (!comparePa.ok && comparePa.code === "GITHUB_TOKEN_MISSING_IN_PROJECT_SETTINGS") {
            const gateReason = "github_compare_unavailable_no_token";
            appendTaskProgressLog({
              kind: "execution",
              phase: "git_reflection_gate",
              projectId,
              taskId,
              userId: actorUserId,
              detail: {
                passed: false,
                gateReason,
                runId: cr.runId,
                commitHash: cr.commitHash ?? null,
                changedFileCount: cr.changedFiles.length,
                outcome: "pending_apply",
              },
            });
            await prisma.task.update({
              where: { id: taskId },
              data: {
                executionWorkflowStatus: EXECUTION_WORKFLOW.PENDING_APPLY,
                lastEvalResult: "pending_apply",
                lastEvalSummary: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
              },
            });
            await prisma.taskExecutionRun.update({
              where: { id: execRun.id },
              data: {
                cursorRunId: cr.runId,
                cursorSummary: cr.summary,
                branchName: headPending,
                commitSha: cr.commitHash ?? null,
                changedFiles: cr.changedFiles as unknown as object,
                gitSummary: cr.summary.slice(0, 24_000),
                validationOutput: null,
                commitStatus: "github_compare_missing_token",
                pushStatus: "delegated_to_cursor",
                status: "awaiting_git_reflection",
                evaluationReason: "git_reflection_gate_blocked: github_compare_unavailable_no_token",
              },
            });
            await updateTaskOrchestrationSnapshot(taskId, {
              branch: headPending,
              commitStatus: "github_compare_missing_token",
              pushStatus: "delegated_to_cursor",
              commitSha: cr.commitHash ?? null,
              changedFileCount: cr.changedFiles.length,
            });
            await refreshWorkflowStates(projectId);
            steps.push({
              phase: "git_reflection_gate",
              taskId,
              runId: cr.runId,
              branch: headPending,
              commitHash: cr.commitHash ?? null,
              changedFileCount: cr.changedFiles.length,
              passed: false,
              reason: gateReason,
            });
            return {
              ok: true,
              steps,
              message: GITHUB_REST_MISSING_TOKEN_USER_MESSAGE,
            };
          }
        }

        const gateReason = "no_commit_and_no_changed_files";
        console.info("[execution-loop][completion-gate] reflection not confirmed — pending_apply", {
          taskId,
          runId: cr.runId,
          branch: cr.branchName,
          commitHash: cr.commitHash ?? null,
          changedFiles: cr.changedFiles.length,
          executionStatus: cr.executionStatus,
          finalCompletionReason: "blocked_no_git_evidence",
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "git_reflection_gate",
          projectId,
          taskId,
          userId: actorUserId,
          detail: {
            passed: false,
            gateReason,
            runId: cr.runId,
            commitHash: cr.commitHash ?? null,
            changedFileCount: cr.changedFiles.length,
            outcome: "pending_apply",
          },
        });

        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.PENDING_APPLY,
            lastEvalResult: "pending_apply",
            lastEvalSummary: isEnvTestTask
              ? "ENV_TEST: Cursor 응답에 커밋·변경 파일 메타가 없습니다. GitHub에 푸시됐다면 실행 환경의 GitHub 인증·저장소 URL·베이스 브랜치를 확인한 뒤 다시 실행하세요. 플랫폼은 GitHub compare API로 반영을 확인합니다."
              : "Cursor 에이전트는 종료되었으나 commit·변경 파일이 보고되지 않아 코드 반영을 확인할 수 없습니다. Cursor에서 실제 반영 여부를 확인한 뒤 이 Task만 다시 실행하세요.",
          },
        });

        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: {
            cursorRunId: cr.runId,
            cursorSummary: cr.summary,
            branchName: cr.branchName,
            commitSha: cr.commitHash ?? null,
            changedFiles: cr.changedFiles as unknown as object,
            gitSummary: cr.summary.slice(0, 24_000),
            validationOutput: null,
            commitStatus: "no_commit_hash",
            pushStatus: "delegated_to_cursor",
            status: "awaiting_git_reflection",
            evaluationReason:
              "git_reflection_unconfirmed: commitHash 없음 · changedFiles=0 — Task 완료 처리 생략(pending_apply)",
          },
        });

        await updateTaskOrchestrationSnapshot(taskId, {
          branch: cr.branchName,
          commitStatus: "no_commit_hash",
          pushStatus: "delegated_to_cursor",
          commitSha: cr.commitHash ?? null,
          changedFileCount: cr.changedFiles.length,
        });

        await appendTaskHistory({
          projectId,
          taskId,
          actorType: TaskHistoryActorType.SYSTEM,
          actorId: actorUserId,
          eventType: TaskHistoryEventType.EXECUTION_LOOP_TASK_STEP,
          summary: "Git 반영 미확인 — pending_apply (에이전트 종료만으로 완료 처리 안 함)",
          detailJson: {
            runId: cr.runId,
            branch: cr.branchName,
            commitHash: cr.commitHash ?? null,
            changedFiles: cr.changedFiles.length,
            gateReason,
          },
        });

        await refreshWorkflowStates(projectId);

        steps.push({
          phase: "git_reflection_gate",
          taskId,
          runId: cr.runId,
          branch: cr.branchName,
          commitHash: cr.commitHash ?? null,
          changedFileCount: cr.changedFiles.length,
          passed: false,
          reason: gateReason,
        });

        return {
          ok: true,
          steps,
          message:
            "에이전트는 종료되었지만 Git 반영(commit·변경 파일)이 확인되지 않아 완료 처리하지 않았습니다. 상세 보기의 실행 기록을 확인하세요.",
        };
      }

      steps.push({
        phase: "git_reflection_gate",
        taskId,
        runId: cr.runId,
        branch: cr.branchName,
        commitHash: cr.commitHash ?? null,
        changedFileCount: cr.changedFiles.length,
        passed: true,
        reason: "commit_or_changed_files_or_summary_evidence",
      });

      console.info("[execution-loop][completion-gate] reflection confirmed — proceeding to review/eval", {
        taskId,
        runId: cr.runId,
        branch: cr.branchName,
        commitHash: cr.commitHash ?? null,
        changedFiles: cr.changedFiles.length,
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "git_reflection_gate",
        projectId,
        taskId,
        userId: actorUserId,
        detail: {
          passed: true,
          runId: cr.runId,
          commitHash: cr.commitHash ?? null,
          changedFileCount: cr.changedFiles.length,
        },
      });

      await prisma.task.update({
        where: { id: taskId },
        data: { executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEWING },
      });

      await prisma.taskExecutionRun.update({
        where: { id: execRun.id },
        data: {
          cursorRunId: cr.runId,
          cursorSummary: cr.summary,
          branchName: cr.branchName,
          commitSha: cr.commitHash ?? null,
          changedFiles: cr.changedFiles as unknown as object,
          gitSummary: cr.summary.slice(0, 24_000),
          validationOutput: null,
          commitStatus: cr.commitHash ? "reported_by_cursor" : "reported_changed_files",
          pushStatus: "delegated_to_cursor",
        },
      });

      // ---- 역할 분리 실행 모델 ----
      // 1) Cursor 종료 후: GitHub compare로 실제 push된 변경 증거를 수집하고, "구현 완료" 상태로 전이한다.
      const elapsedMsSinceExecRunStart = Date.now() - execRun.createdAt.getTime();
      let envTestCompareOkAtMs: number | null = null;
      if (isEnvTestTask) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_branch_reflection_check_started",
          projectId,
          taskId,
          userId: actorUserId,
          detail: {
            base: setup.baseBranch,
            head: cr.branchName,
            elapsedMsSinceRunStart: elapsedMsSinceExecRunStart,
            step: "post_cursor",
          },
        });
      }
      const compare = await fetchGithubCompareSnapshot({
        repoUrl,
        base: setup.baseBranch,
        head: cr.branchName,
        maxFiles: 80,
        githubAccessToken: setup.githubAccessToken ?? null,
        projectId,
        allowUnauthenticated: isEnvTestTask ? true : undefined,
      });
      if (isEnvTestTask && compare.ok && compare.data.aheadBy > 0) {
        envTestCompareOkAtMs = Date.now();
        appendTaskProgressLog({
          kind: "execution",
          phase: "env_test_branch_reflection_confirmed",
          projectId,
          taskId,
          userId: actorUserId,
          detail: {
            aheadBy: compare.data.aheadBy,
            headSha: compare.data.headSha ?? null,
            elapsedMsSinceRunStart: elapsedMsSinceExecRunStart,
            step: "post_cursor",
          },
        });
      }
      const gitEvidence = compare.ok
        ? {
            baseBranch: setup.baseBranch,
            headBranch: cr.branchName,
            headSha: compare.data.headSha,
            changedFiles: compare.data.changedFiles,
            diffSummary: compare.data.diffSummary,
          }
        : null;

      if (compare.ok) {
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: {
            commitSha: compare.data.headSha ?? cr.commitHash ?? null,
            changedFiles: compare.data.changedFiles as unknown as object,
            gitSummary: compare.data.diffSummary.slice(0, 24_000),
            commitStatus: compare.data.headSha ? "pushed_commit_detected" : "pushed_commit_unknown",
            pushStatus:
              isEnvTestTask && compare.data.aheadBy > 0 ? "pushed_by_github_compare" : "pushed_by_cursor",
          },
        });
      } else {
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: {
            commitStatus: "pushed_commit_unknown",
            pushStatus: "unknown",
            evaluationReason: `github_compare_failed:${compare.code}:${compare.message}`.slice(0, 8000),
          },
        });
      }

      const pushDetected = isEnvTestTask
        ? compare.ok && compare.data.aheadBy > 0
        : compare.ok;
      const commitDetected =
        Boolean(gitEvidence?.headSha ?? cr.commitHash ?? null) || (isEnvTestTask && pushDetected);

      // RUNNING -> COMMITTED (커밋/푸시 증거 수집 완료)
      if (commitDetected && !isEnvTestTask) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "commit_detected",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { headSha: gitEvidence?.headSha ?? cr.commitHash ?? null },
        });
      }
      if (pushDetected && !isEnvTestTask) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "push_detected",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { branch: cr.branchName },
        });
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.COMMITTED,
          lastEvalResult: "committed",
          lastEvalSummary: isEnvTestTask
            ? "ENV_TEST: 푸시 확인됨. 플랫폼이 GitHub PR을 생성·갱신합니다."
            : "Cursor commit/push 완료. PR(Open) 감지 후 다음 Task로 진행합니다.",
        },
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "state_transition: RUNNING → COMMITTED",
        projectId,
        taskId,
        userId: actorUserId,
        detail: {
          branch: cr.branchName,
          headSha: gitEvidence?.headSha ?? cr.commitHash ?? null,
          changedFileCount: gitEvidence?.changedFiles.length ?? null,
          compareOk: compare.ok,
          ...(isEnvTestTask && compare.ok
            ? { aheadBy: compare.data.aheadBy, behindBy: compare.data.behindBy }
            : {}),
        },
      });

      // COMMITTED -> PR_OPENED
      let prUrl: string | null = null;
      let prNumber: number | null = null;

      if (isEnvTestTask) {
        if (!pushDetected) {
          await prisma.taskExecutionRun.update({
            where: { id: execRun.id },
            data: {
              status: "failed",
              evaluationDecision: "failed",
              evaluationReason: "env_test_push_not_detected",
            },
          });
          await prisma.task.update({
            where: { id: taskId },
            data: {
              executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
              lastEvalResult: "failed",
              lastEvalSummary: "ENV_TEST: GitHub compare로 원격 푸시를 확인하지 못했습니다.",
            },
          });
          await refreshWorkflowStates(projectId);
          return {
            ok: false,
            steps,
            message: "환경 연결 테스트: 원격 푸시가 확인되지 않았습니다. Cursor 푸시·브랜치·토큰을 확인하세요.",
          };
        }
        const prPhaseMain = await runEnvTestPlatformPrPhase({
          projectId,
          taskId,
          actorUserId,
          taskKind: taskRow.taskKind,
          repoUrl,
          baseBranch: setup.baseBranch,
          headBranch: cr.branchName,
          githubAccessToken: setup.githubAccessToken ?? null,
          executionRunCreatedAt: execRun.createdAt,
          compareOkAtMs: envTestCompareOkAtMs,
        });
        if (!prPhaseMain.ok) {
          appendTaskProgressLog({
            kind: "execution",
            phase: "env_test_pr_create_failed",
            projectId,
            taskId,
            userId: actorUserId,
            detail: { message: prPhaseMain.message.slice(0, 800) },
          });
          await prisma.taskExecutionRun.update({
            where: { id: execRun.id },
            data: {
              status: "failed",
              evaluationDecision: "failed",
              evaluationReason: `env_test_platform_pr_failed:${prPhaseMain.message}`.slice(0, 8000),
            },
          });
          await prisma.task.update({
            where: { id: taskId },
            data: {
              executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
              lastEvalResult: "failed",
              lastEvalSummary: `ENV_TEST: 플랫폼 PR 실패 — ${prPhaseMain.message}`.slice(0, 1500),
            },
          });
          await refreshWorkflowStates(projectId);
          return {
            ok: false,
            steps,
            message: "환경 연결 테스트에 실패했습니다. 플랫폼이 GitHub PR을 생성·갱신하지 못했습니다.",
          };
        }
        prUrl = prPhaseMain.prUrl;
        prNumber = prPhaseMain.prNumber;
      } else {
        prUrl = typeof cr.prUrl === "string" ? cr.prUrl : null;
        prNumber = prUrl ? parsePrNumberFromUrl(prUrl) : null;
        if ((pushDetected && (!prUrl || prNumber == null)) || !prUrl || prNumber == null) {
          const found = await findOpenPullRequestByHeadBranch({
            repoUrl,
            headBranch: cr.branchName,
            githubAccessToken: setup.githubAccessToken ?? null,
            projectId,
          });
          if (found) {
            prUrl = found.prUrl;
            prNumber = found.prNumber;
          }
        }
      }

      if (prUrl && prNumber != null) {
        appendTaskProgressLog({
          kind: "execution",
          phase: "pr_detected",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { prUrl, prNumber, branch: cr.branchName },
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "state_transition: COMMITTED → PR_OPENED",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { prUrl, prNumber, branch: cr.branchName },
        });

        const prOpenedCompletedAt = new Date();
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: {
            status: "done",
            evaluationDecision: "done",
            prStatus: `open:${prNumber}:${prUrl}`,
            pushStatus: "pr_opened",
            ...(isEnvTestTask ? { completedAt: prOpenedCompletedAt } : {}),
          },
        });

        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.PR_OPENED,
            status: "DONE",
            lastEvalResult: "pr_opened",
            lastEvalSummary: isEnvTestTask
              ? "플랫폼이 ENV_TEST용 GitHub PR을 생성·갱신하고 PR_OPENED로 처리했습니다."
              : "PR이 생성/열림. 머지/리뷰 대기 없이 다음 Task로 진행합니다.",
            loopRetryCount: 0,
          },
        });

        await updateTaskOrchestrationSnapshot(taskId, {
          branch: cr.branchName,
          commitStatus: commitDetected ? "pushed_commit_detected" : "pushed_commit_unknown",
          pushStatus: "pr_opened",
          commitSha: (gitEvidence?.headSha ?? cr.commitHash ?? null) as string | null,
          changedFileCount: (gitEvidence?.changedFiles.length ?? null) as number | null,
        });

        await refreshWorkflowStates(projectId);

        let envReadinessCommitted: NextTaskReadinessResult | undefined;
        let envMergeRes: Awaited<ReturnType<typeof executeEnvTestPrMergeSmokeTest>> | null = null;
        if (isEnvTestTask) {
          // PR_OPENED 직후 ENV_TEST 전용 머지 자동 실행(스모크 테스트).
          envMergeRes = await executeEnvTestPrMergeSmokeTest({
            projectId,
            actorUserId,
          });

          envReadinessCommitted = await evaluateNextTaskReadiness({
            projectId,
            excludeTaskExecutionRunId: execRun.id,
          });
        }

        if (
          singleTaskId ||
          !effectiveAutoAdvance ||
          (isEnvTestTask && envMergeRes)
        ) {
          if (isEnvTestTask && envReadinessCommitted) {
            const mergeOk = envMergeRes?.ok === true;
            return {
              ok: mergeOk,
              steps,
              message: mergeOk
                ? (envMergeRes?.message ??
                    "환경 연결 테스트가 완료되었습니다. GitHub 머지가 확인되었습니다.")
                : (envMergeRes?.message ?? "환경 연결 테스트: 머지 단계에서 실패했습니다."),
              nextTaskReadiness: envReadinessCommitted,
            };
          }
          return { ok: true, steps, message: "PR이 열렸습니다(PR_OPENED). 자동 진행이 꺼져 루프를 종료합니다." };
        }
        continue;
      }

      // PR(Open) 감지 실패: 기존(리뷰/머지) 경로로 폴백한다.
      await prisma.task.update({
        where: { id: taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_PENDING,
          lastEvalResult: "review_pending",
          lastEvalSummary: "Cursor 구현 완료. PR(Open) 감지 실패: GitHub의 실제 변경분 기준으로 AI 리뷰 대기 중입니다.",
        },
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "review_pending",
        projectId,
        taskId,
        userId: actorUserId,
        detail: {
          branch: cr.branchName,
          headSha: gitEvidence?.headSha ?? null,
          changedFileCount: gitEvidence?.changedFiles.length ?? null,
          compareOk: compare.ok,
          compareError: compare.ok ? null : `${compare.code}:${compare.message}`.slice(0, 400),
          prDetected: false,
        },
      });

      // 2) Reviewer 단계 (execution-review). 반드시 실제 GitHub compare 기반 증거를 포함한다.
      if (executionReviewerCount === 0) {
        // Reviewer가 없으면 정책상 진행 불가로 막는다 (역할 분리 강제).
        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_REJECTED,
            lastEvalResult: "review_rejected",
            lastEvalSummary: "AI Reviewer가 설정되지 않아 자동 리뷰를 수행할 수 없습니다. Project Members에서 reviewer를 추가하세요.",
          },
        });
        await refreshWorkflowStates(projectId);
        return { ok: false, steps, message: "AI Reviewer 미설정" };
      }

      console.info("[execution-loop] reviewer start", { taskId, projectId });
      let evalPack: Awaited<ReturnType<typeof evaluateExecutionResult>>;
      try {
        evalPack = await evaluateExecutionResult({
          projectId,
          task: {
            title: taskRow.name,
            description: taskRow.description,
            acceptanceCriteria: criteria,
          },
          cursorResult: cr,
          changedFiles: gitEvidence?.changedFiles ?? cr.changedFiles,
          summary: cr.summary,
          acceptanceCriteria: criteria,
          stopOnTestFailure,
          stopOnOutOfScopeChange,
          allowedPathGlobs: mergedAllowedGlobs,
          repoUrl,
          executionReviewerCount,
          gitEvidence,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_REJECTED,
            lastEvalResult: "review_rejected",
            lastEvalSummary: `리뷰 단계 예외: ${errMsg.slice(0, 1500)}`,
          },
        });
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { status: "failed", evaluationDecision: "failed", evaluationReason: `review_exception:${errMsg}`.slice(0, 8000), runError: errMsg.slice(0, 8000) },
        });
        await refreshWorkflowStates(projectId);
        return { ok: false, steps, message: errMsg };
      }

      const reviewerVerdict = evalPack.result.decision;
      await prisma.taskExecutionRun.update({
        where: { id: execRun.id },
        data: {
          evaluationReason: evalPack.result.reason.slice(0, 8000),
          evaluationDecision: reviewerVerdict,
          status: "reviewing",
          ...(evalPack.reviewerSteps.length > 0 ? { evaluationReviewerSteps: evalPack.reviewerSteps as object } : {}),
        },
      });

      if (reviewerVerdict !== "done") {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_REJECTED,
            lastEvalResult: "review_rejected",
            lastEvalSummary: evalPack.result.reason,
          },
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "review_rejected",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { verdict: reviewerVerdict, reason: evalPack.result.reason.slice(0, 1200) },
        });
        await refreshWorkflowStates(projectId);
        return { ok: false, steps, message: "Reviewer rejected/retry" };
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.REVIEW_APPROVED,
          lastEvalResult: "review_approved",
          lastEvalSummary: evalPack.result.reason,
        },
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "review_approved",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { reason: evalPack.result.reason.slice(0, 1200) },
      });

      // 3) SCM Manager 단계: PR 생성 + merge (Cursor는 절대 PR/merge 하지 않음)
      const scmCount = await countScmManagerAiMembers(projectId);
      if (scmCount === 0) {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING,
            lastEvalResult: "merge_pending",
            lastEvalSummary: "SCM Manager 미설정: PR 생성/merge를 수행할 수 없습니다.",
          },
        });
        await refreshWorkflowStates(projectId);
        return { ok: false, steps, message: "SCM Manager 미설정" };
      }

      const scmDecisionPack = await tryRunScmManagerWithAiMembers({
        projectId,
        repoUrl,
        taskId,
        taskTitle: taskRow.name,
        taskDescription: taskRow.description,
        branch: cr.branchName,
        baseBranch: setup.baseBranch,
        reviewerDecision: reviewerVerdict,
        reviewerSummary: evalPack.result.reason,
      });
      if (!scmDecisionPack || scmDecisionPack.decision !== "approve_merge") {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING,
            lastEvalResult: "merge_pending",
            lastEvalSummary: scmDecisionPack?.summary || "SCM Manager 판단 대기/보류",
          },
        });
        await refreshWorkflowStates(projectId);
        return { ok: true, steps, message: "SCM Manager hold" };
      }

      await prisma.task.update({
        where: { id: taskId },
        data: { executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING, lastEvalResult: "merge_pending" },
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "merge_pending",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { branch: cr.branchName },
      });

      const prCreate = await createGithubPullRequestFromBranch({
        repoUrl,
        baseBranch: setup.baseBranch,
        headBranch: cr.branchName,
        title: `[auto] ${taskRow.name}`.slice(0, 240),
        body: `Automated by JYOrchestration SCM Manager.\n\nTask: ${taskId}\nBranch: ${cr.branchName}\n\nReviewer: approved\n\nSummary:\n${evalPack.result.reason}`.slice(0, 6000),
        githubAccessToken: setup.githubAccessToken ?? null,
        projectId,
      });
      if (!prCreate.ok) {
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { prStatus: `pr_create_failed:${prCreate.code}`.slice(0, 80) },
        });
        await prisma.task.update({
          where: { id: taskId },
          data: { executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING, lastEvalSummary: prCreate.message },
        });
        await refreshWorkflowStates(projectId);
        return { ok: false, steps, message: prCreate.message };
      }

      await prisma.taskExecutionRun.update({
        where: { id: execRun.id },
        data: { prStatus: "open", pushStatus: "pushed_by_cursor" },
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "pr_created",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { prUrl: prCreate.data.pullRequestUrl, prNumber: prCreate.data.pullRequestNumber },
      });

      if (!isAutoMergeEnabled()) {
        await prisma.task.update({
          where: { id: taskId },
          data: { executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING, lastEvalSummary: "PR 생성 완료. 자동 merge 비활성화." },
        });
        await refreshWorkflowStates(projectId);
        return { ok: true, steps, message: "PR created; merge pending" };
      }

      const mr = await autoMergePullRequest({
        prUrl: prCreate.data.pullRequestUrl,
        githubAccessToken: setup.githubAccessToken ?? null,
        commitTitle: `Auto-merge: ${taskRow.name}`.slice(0, 240),
      });
      if (!mr.ok) {
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { prStatus: `merge_failed:${mr.code}`.slice(0, 80) },
        });
        await prisma.task.update({
          where: { id: taskId },
          data: { executionWorkflowStatus: EXECUTION_WORKFLOW.MERGE_PENDING, lastEvalSummary: mr.message },
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "auto_merge_failed",
          projectId,
          taskId,
          userId: actorUserId,
          detail: { prUrl: prCreate.data.pullRequestUrl, code: mr.code, message: mr.message, httpStatus: mr.httpStatus, ...(mr.detail ?? {}) },
        });
        await refreshWorkflowStates(projectId);
        return { ok: false, steps, message: mr.message };
      }

      await prisma.taskExecutionRun.update({
        where: { id: execRun.id },
        data: { prStatus: "merged", status: "done", evaluationDecision: "done" },
      });
      await prisma.task.update({
        where: { id: taskId },
        data: { executionWorkflowStatus: EXECUTION_WORKFLOW.MERGED, status: "DONE", lastEvalResult: "merged", lastEvalSummary: "Merged to main." },
      });
      appendTaskProgressLog({
        kind: "execution",
        phase: "merged",
        projectId,
        taskId,
        userId: actorUserId,
        detail: { prUrl: prCreate.data.pullRequestUrl },
      });
      await refreshWorkflowStates(projectId);

      // merge 완료 이후에만 다음 Task를 진행할 수 있으므로, 루프는 계속 진행 가능

      if (noExecutionReviewers) {
        console.info("[execution-loop] review skipped (cursor-only path)", {
          taskId,
          verdict: evalPack.result.decision,
        });
      } else {
        console.info("[execution-loop] review done", {
          taskId,
          verdict: evalPack.result.decision,
          reviewerSteps: evalPack.reviewerSteps.length,
        });
      }

      let evalR = evalPack.result;
      let verdict = evalR.decision;

      const priorRetryEval = await prisma.taskExecutionRun.findFirst({
        where: {
          taskId,
          id: { not: execRun.id },
          evaluationDecision: "retry",
        },
        orderBy: { createdAt: "desc" },
      });
      if (
        stopOnRepeatedFailure &&
        verdict === "retry" &&
        priorRetryEval?.evaluationReason &&
        priorRetryEval.evaluationReason === evalR.reason
      ) {
        verdict = "failed";
        evalR = {
          ...evalR,
          decision: "failed",
          reason: `동일 평가 사유 반복(stopOnRepeatedFailure): ${evalR.reason}`,
        };
      }

      steps.push({
        phase: "evaluate",
        taskId,
        verdict,
        summary: evalR.reason,
      });

      await prisma.taskExecutionRun.update({
        where: { id: execRun.id },
        data: {
          evaluationReason: evalR.reason.slice(0, 8000),
          evaluationDecision: verdict,
          status: verdict === "done" ? "reviewing" : verdict === "retry" ? "retry_needed" : "failed",
          ...(evalPack.reviewerSteps.length > 0
            ? { evaluationReviewerSteps: evalPack.reviewerSteps as object }
            : {}),
        },
      });

      await appendTaskHistory({
        projectId,
        taskId,
        actorType: TaskHistoryActorType.LLM,
        actorId: actorUserId,
        eventType: TaskHistoryEventType.EXECUTION_LOOP_TASK_STEP,
        summary:
          noExecutionReviewers && verdict === "done"
            ? `평가: ${verdict} (리뷰 생략 · AI 멤버 미설정)`
            : `평가: ${verdict}`,
        detailJson: {
          verdict,
          reason: evalR.reason,
          score: evalR.score,
          runId: cr.runId,
          reviewSkipped: noExecutionReviewers,
        },
      });

      const fileCount = cr.changedFiles.length;
      const commitSnapshotStatus = cr.commitHash
        ? "cursor_committed"
        : fileCount > 0
          ? "cursor_changed_files_only"
          : "reported_via_summary_evidence";

      if (verdict === "done") {
        const sensitiveGate =
          effectiveRequireApprovalForSensitive &&
          taskLooksSensitive({
            name: taskRow.name,
            description: taskRow.description,
            acceptanceCriteria: criteria,
          });

        if (sensitiveGate) {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              executionWorkflowStatus: EXECUTION_WORKFLOW.AWAITING_HUMAN,
              lastEvalResult: "awaiting_human",
              lastEvalSummary:
                "민감 Task 정책: 자동 검토는 통과했으나 사람 승인 후 DAG가 진행됩니다. Task에서 「민감 작업 승인」을 눌러 주세요.",
            },
          });
          await prisma.taskExecutionRun.update({
            where: { id: execRun.id },
            data: {
              status: "reviewing",
              evaluationDecision: "done",
              evaluationReason:
                "policy_sensitive_awaiting_human — " + evalR.reason.slice(0, 6000),
            },
          });
          await updateTaskOrchestrationSnapshot(taskId, {
            branch: cr.branchName,
            commitStatus: commitSnapshotStatus,
            pushStatus: "cursor",
            commitSha: cr.commitHash ?? null,
            changedFileCount: fileCount,
          });
          await refreshWorkflowStates(projectId);
          steps.push({
            phase: "stop",
            reason: "awaiting_human_sensitive",
          });
          return {
            ok: true,
            steps,
            message:
              "민감 Task 정책으로 사람 승인 대기 중입니다. 승인 후 루프를 다시 실행하세요.",
          };
        }

        if (setup.autoPr) {
          await prisma.taskExecutionRun.update({
            where: { id: execRun.id },
            data: { prStatus: cr.prUrl ? "pr_reported_by_cursor" : "pending_capability" },
          });
        }

        const prOpenedNow = Boolean(cr.prUrl);

        console.info("[execution-loop][completion]", {
          taskId,
          runId: cr.runId,
          branch: cr.branchName,
          commitHash: cr.commitHash ?? null,
          changedFiles: fileCount,
          finalCompletionReason: "task_marked_done_after_git_reflection_and_eval",
          verdict,
          reviewSkipped: noExecutionReviewers,
        });
        appendTaskProgressLog({
          kind: "execution",
          phase: "task_done",
          projectId,
          taskId,
          userId: actorUserId,
          detail: {
            runId: cr.runId,
            verdict,
            branch: cr.branchName,
            commitHash: cr.commitHash ?? null,
            changedFileCount: fileCount,
            reviewSkipped: noExecutionReviewers,
          },
        });

        // PR_OPENED 단계에서는 “머지 완료”를 기다리지 않습니다.
        // (자동 머지는 background로 시도; 다음 Task 진행은 PR_OPENED 기준)
        if (setup.autoPr && isAutoMergeEnabled() && cr.prUrl) {
          const prUrlNow = cr.prUrl;
          void (async () => {
            appendTaskProgressLog({
              kind: "execution",
              phase: "auto_merge_start",
              projectId,
              taskId,
              userId: actorUserId,
              detail: { prUrl: prUrlNow },
            });
            const mr = await autoMergePullRequest({
              prUrl: prUrlNow,
              githubAccessToken: setup.githubAccessToken ?? null,
              commitTitle: `Auto-merge: ${taskRow.name}`.slice(0, 240),
            });
            if (mr.ok) {
              await prisma.taskExecutionRun.update({
                where: { id: execRun.id },
                data: { prStatus: "merged" },
              });
              appendTaskProgressLog({
                kind: "execution",
                phase: "auto_merge_ok",
                projectId,
                taskId,
                userId: actorUserId,
                detail: { prUrl: prUrlNow, ...mr.detail },
              });
            } else {
              await prisma.taskExecutionRun.update({
                where: { id: execRun.id },
                data: { prStatus: `merge_failed:${mr.code}`.slice(0, 80) },
              });
              appendTaskProgressLog({
                kind: "execution",
                phase: "auto_merge_failed",
                projectId,
                taskId,
                userId: actorUserId,
                detail: {
                  prUrl: prUrlNow,
                  code: mr.code,
                  message: mr.message,
                  httpStatus: mr.httpStatus,
                  ...(mr.detail ?? {}),
                },
              });
            }
          })();
        }

        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: prOpenedNow ? EXECUTION_WORKFLOW.PR_OPENED : EXECUTION_WORKFLOW.DONE,
            status: "DONE",
            lastEvalResult: prOpenedNow ? "pr_opened" : "done",
            lastEvalSummary: prOpenedNow
              ? "Cursor/플랫폼이 PR을 열었습니다. PR_OPENED 기반으로 다음 Task를 진행합니다."
              : evalR.reason,
            loopRetryCount: 0,
          },
        });

        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { status: "done", evaluationDecision: "done" },
        });

        await updateTaskOrchestrationSnapshot(taskId, {
          branch: cr.branchName,
          commitStatus: commitSnapshotStatus,
          pushStatus: prOpenedNow ? "pr_opened" : "cursor",
          commitSha: cr.commitHash ?? null,
          changedFileCount: fileCount,
        });

        await refreshWorkflowStates(projectId);
        if (singleTaskId || !effectiveAutoAdvance) {
          await appendTaskHistory({
            projectId,
            taskId,
            actorType: TaskHistoryActorType.SYSTEM,
            actorId: actorUserId,
            eventType: TaskHistoryEventType.EXECUTION_LOOP_FINISHED,
            summary:
              singleTaskId || !effectiveAutoAdvance ? "실행 종료(단일 또는 autoAdvance off)" : "continue",
            detailJson: {},
          }).catch(() => {});
          if (!effectiveAutoAdvance && !singleTaskId) {
            return { ok: true, steps, message: "Task 완료. 자동 진행이 꺼져 루프를 중단했습니다." };
          }
          if (singleTaskId) {
            return { ok: true, steps, message: "단일 Task 실행이 완료되었습니다." };
          }
          continue;
        }
        continue;
      }

      if (verdict === "retry") {
        const cur = taskRow.loopRetryCount ?? 0;
        if (cur >= maxRetries) {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
              lastEvalResult: "failed",
              lastEvalSummary: `retry 상한: ${evalR.reason}`,
            },
          });
          await prisma.taskExecutionRun.update({
            where: { id: execRun.id },
            data: { status: "failed", evaluationDecision: "failed" },
          });
          await updateTaskOrchestrationSnapshot(taskId, {
            branch: cr.branchName,
            commitStatus: "skipped",
            pushStatus: "n/a",
            changedFileCount: fileCount,
          });
          if (singleTaskId) break;
          break;
        }
        await prisma.task.update({
          where: { id: taskId },
          data: {
            loopRetryCount: cur + 1,
            executionWorkflowStatus: EXECUTION_WORKFLOW.READY,
            lastEvalResult: "retry",
            lastEvalSummary: evalR.reason,
          },
        });
        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { status: "retry_needed", evaluationDecision: "retry" },
        });
        await updateTaskOrchestrationSnapshot(taskId, {
          branch: cr.branchName,
          changedFileCount: fileCount,
        });
        await refreshWorkflowStates(projectId);
        if (singleTaskId) break;
        continue;
      }

      await prisma.task.update({
        where: { id: taskId },
        data: {
          executionWorkflowStatus: EXECUTION_WORKFLOW.FAILED,
          lastEvalResult: "failed",
          lastEvalSummary: evalR.reason,
        },
      });
      await prisma.taskExecutionRun.update({
        where: { id: execRun.id },
        data: { status: "failed", evaluationDecision: "failed" },
      });
      await updateTaskOrchestrationSnapshot(taskId, {
        branch: cr.branchName,
        commitStatus: "skipped",
        pushStatus: "n/a",
        changedFileCount: fileCount,
      });
      if (singleTaskId) break;
      break;
    }

    if (lastTaskId) {
      await appendTaskHistory({
        projectId,
        taskId: lastTaskId,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: actorUserId,
        eventType: TaskHistoryEventType.EXECUTION_LOOP_FINISHED,
        summary: "실행 루프 종료",
        detailJson: { steps: steps.length },
      }).catch(() => {});
    }

    return { ok: true, steps, message: "실행 루프가 종료되었습니다." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ phase: "stop", reason: msg });
    return { ok: false, steps, message: msg };
  } finally {
    loopLocks.delete(projectId);
  }
}

export function pauseExecutionLoop(projectId: string): void {
  setExecutionLoopPaused(projectId, true);
}

export function resumeExecutionLoop(projectId: string): void {
  setExecutionLoopPaused(projectId, false);
}
