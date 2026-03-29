import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { buildCursorExecutionPrompt } from "@/lib/execution/buildCursorExecutionPrompt";
import { executeCursorRun } from "@/lib/execution/cursorExecutionAdapter";
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
import { pickNextReadyTask, type TaskForPick } from "./pickNextReadyTask";
import type { LoopStepRecord, RunExecutionLoopResult } from "./runLoopTypes";
import { EXECUTION_WORKFLOW } from "./workflowConstants";
import { normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";

export type { LoopStepRecord, RunExecutionLoopResult } from "./runLoopTypes";

const loopLocks = new Set<string>();

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
    const stubCursor = process.env.EXECUTION_LOOP_STUB_CURSOR === "1";
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
      select: { name: true },
    });
    const projectName = project?.name ?? projectId;

    await initializeLoopParticipants(projectId);

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

    while (true) {
      if (isExecutionLoopPaused(projectId)) {
        steps.push({ phase: "stop", reason: "paused" });
        return { ok: true, steps, message: "실행 루프가 일시정지 상태입니다." };
      }

      const rows = await loadWorkflowGraphTasks(projectId);
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
      }));

      let next = pickNextReadyTask(pickRows);
      if (singleTaskId) {
        const forced = rows.find((r) => r.id === singleTaskId);
        if (!forced || forced.status !== "TODO") {
          return { ok: false, steps, message: "지정한 Task를 찾을 수 없거나 TODO가 아닙니다." };
        }
        if (forced.executionWorkflowStatus !== EXECUTION_WORKFLOW.READY) {
          return {
            ok: false,
            steps,
            message: "지정한 Task가 ready 상태가 아닙니다. 선행 Task를 완료하세요.",
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
        },
      });
      if (!taskRow) break;

      const criteria = parseCriteria(taskRow.acceptanceCriteria);

      const branchPlan = computeExecutionBranchPlan({
        branchStrategy: setup.branchStrategy,
        branchPrefix: setup.branchPrefix,
        projectId,
        taskId: taskRow.id,
        taskTitle: taskRow.name,
        baseBranch: setup.baseBranch,
      });

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
          allowedPathGlobs: allowedGlobs,
        }
      );

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

      const cursorOutcome = await executeCursorRun({
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
        allowedPaths: allowedGlobs.length ? allowedGlobs : undefined,
      });

      steps.push({
        phase: "cursor",
        taskId,
        ok: cursorOutcome.ok,
        runId: cursorOutcome.ok ? cursorOutcome.result.runId : undefined,
        error: cursorOutcome.ok ? undefined : cursorOutcome.error,
      });

      if (cursorOutcome.ok) {
        const cr0 = cursorOutcome.result;
        console.info("[execution-loop] cursor done (git·커밋·푸시는 Cursor Agent에 위임)", {
          taskId,
          runId: cr0.runId,
          branch: cr0.branchName,
          commitHash: cr0.commitHash ?? null,
          changedFiles: cr0.changedFiles.length,
          executionStatus: cr0.executionStatus,
        });
      } else {
        console.error("[execution-loop] cursor failed", {
          taskId,
          error: cursorOutcome.error,
          logTail: cursorOutcome.logs?.slice(-5),
        });
      }

      if (!cursorOutcome.ok) {
        const errMsg = cursorOutcome.error ?? "cursor failed";
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

      const cr = cursorOutcome.result;

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
          commitStatus: cr.commitHash ? "reported_by_cursor" : "no_commit_hash",
          pushStatus: "delegated_to_cursor",
        },
      });

      if (noExecutionReviewers) {
        console.info("[execution-loop] 리뷰 단계 생략됨 (AI 멤버 미설정)", { taskId, projectId });
      } else {
        console.info("[execution-loop] review start", { taskId, projectId });
      }

      const evalPack = await evaluateExecutionResult({
        projectId,
        task: {
          title: taskRow.name,
          description: taskRow.description,
          acceptanceCriteria: criteria,
        },
        cursorResult: cr,
        changedFiles: cr.changedFiles,
        summary: cr.summary,
        acceptanceCriteria: criteria,
        stopOnTestFailure,
        stopOnOutOfScopeChange,
        allowedPathGlobs: allowedGlobs,
        repoUrl,
        executionReviewerCount,
      });

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
            commitStatus: cr.commitHash ? "cursor_committed" : "cursor_no_hash",
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
            data: { prStatus: "pending_capability" },
          });
        }

        await prisma.task.update({
          where: { id: taskId },
          data: {
            executionWorkflowStatus: EXECUTION_WORKFLOW.DONE,
            status: "DONE",
            lastEvalResult: "done",
            lastEvalSummary: evalR.reason,
            loopRetryCount: 0,
          },
        });

        await prisma.taskExecutionRun.update({
          where: { id: execRun.id },
          data: { status: "done", evaluationDecision: "done" },
        });

        await updateTaskOrchestrationSnapshot(taskId, {
          branch: cr.branchName,
          commitStatus: cr.commitHash ? "cursor_committed" : "cursor_no_hash",
          pushStatus: "cursor",
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
