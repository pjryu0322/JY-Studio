/**
 * Deterministic in-process checks for the isolated MVP stack (no routes, no DB).
 * Import and call `runMvpSelfCheck()` from tests or a one-off script under src/mvp only.
 */

import {
  mvpClearTaskStore,
  mvpSeedProjectTasks,
  listAllTasks,
  reorderTasks,
  confirmTask,
  type Task,
} from "./task/taskService";
import { buildTaskPrompt, clearPromptCache } from "./prompt/promptService";
import {
  mvpClearReviewPolicy,
  mvpConfigureReviewFailures,
  mvpReviewForceNonRetryableOnce,
} from "./reviewer/reviewerService";
import {
  mvpResetExecutionState,
  startRun,
  getRunStatus,
  retryTask,
  DEFAULT_MAX_RETRY_COUNT,
} from "./execution/executionService";
import { mvpGetExecutionStepsForRun } from "./execution/executionStepLog";
import {
  mvpGetExecutionStepsForTask,
  mvpGetLastFailureStepForRun,
  mvpGetRetryCountFromSteps,
  mvpSummarizeExecutionStepFlow,
} from "./execution/executionStepProjections";
import { mvpProjectRunSummary } from "./execution/mvpRunSummary";
import {
  mvpTestInstallRunAtRetryLimit,
  mvpTestInstallRunWithNonRetryableFailure,
} from "./testing/mvpExecutionFixtures";
import { evaluateExecutionReadiness } from "./orchestration/orchestrationService";
import { mvpCursorResetTestHooks, mvpCursorFailNextWaits } from "./cursor/cursorService";
import { mvpGitResetStubs } from "./git/gitService";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(`mvpSelfCheck: ${msg}`);
  }
}

function baseTasks(pid: string): Task[] {
  return [
    {
      id: `t-a-${pid}`,
      title: "A",
      description: "first",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 0,
      projectId: pid,
    },
    {
      id: `t-b-${pid}`,
      title: "B",
      description: "second",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 1,
      projectId: pid,
    },
  ];
}

function resetAll(): void {
  mvpClearTaskStore();
  clearPromptCache();
  mvpClearReviewPolicy();
  mvpResetExecutionState();
  mvpCursorResetTestHooks();
  mvpGitResetStubs();
}

/**
 * Runs built-in scenarios; throws on first failure.
 */
export async function runMvpSelfCheck(): Promise<void> {
  const pid = "mvp-self-check";

  resetAll();
  mvpSeedProjectTasks(pid, baseTasks(pid));
  const r1 = await startRun(pid);
  assert(r1.status === "SUCCESS", "two tasks should both succeed");
  assert(r1.tasks.every((t) => t.status === "SUCCESS"), "all task states SUCCESS");
  const steps1 = mvpGetExecutionStepsForRun(r1.id);
  for (let i = 1; i < steps1.length; i += 1) {
    assert(steps1[i]!.sequence === steps1[i - 1]!.sequence + 1, "step sequence must be strictly monotonic");
  }
  const types1 = steps1.map((s) => s.stepType);
  assert(types1.includes("RUN_SUCCESS"), "successful run should log RUN_SUCCESS");
  assert(types1.filter((t) => t === "TASK_COMPLETED").length === 2, "two tasks should log TASK_COMPLETED");
  const tid0 = r1.tasks[0]!.taskId;
  const taskSteps0 = mvpGetExecutionStepsForTask(r1.id, tid0);
  assert(taskSteps0.length > 0, "task-scoped steps should exist for first task");
  assert(taskSteps0.every((s) => s.taskId === tid0), "task filter must only return matching taskId");
  assert(mvpGetLastFailureStepForRun(r1.id) === undefined, "successful run should have no failure step");
  assert(mvpSummarizeExecutionStepFlow(r1.id).length > 0, "flow summary must be non-empty");
  const sumOk = await mvpProjectRunSummary(r1.id);
  assert(sumOk != null, "run summary should exist");
  assert(sumOk.runStatus === "SUCCESS", "summary status SUCCESS");
  assert(sumOk.totalTasks === 2 && sumOk.completedTasks === 2 && sumOk.failedTasks === 0, "summary task counts");
  assert(sumOk.totalStepCount === steps1.length, "summary step count should match log length");
  assert(sumOk.lastFailureCode == null && sumOk.lastFailureMessage == null, "no last failure on success");

  let threw = false;
  try {
    buildTaskPrompt({ taskId: tid0, projectId: "wrong-project" });
  } catch {
    threw = true;
  }
  assert(threw, "buildTaskPrompt must reject cross-project contract mismatch");

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpConfigureReviewFailures(baseTasks(pid)[0]!.id, 1);
  const r2 = await startRun(pid);
  assert(r2.status === "SUCCESS", "review fail once then pass on retry");
  assert(r2.tasks[0]!.status === "SUCCESS", "single task SUCCESS after one forced review failure");

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpCursorFailNextWaits(1);
  const rCursorRetry = await startRun(pid);
  assert(rCursorRetry.status === "SUCCESS", "cursor failure once should retry on same task then succeed");
  assert(rCursorRetry.tasks[0]!.retryCount === 1, "one in-run retry should increment retryCount");
  const stepsCur = mvpGetExecutionStepsForRun(rCursorRetry.id);
  const typesCur = stepsCur.map((s) => s.stepType);
  const iFail = typesCur.indexOf("CURSOR_FAILED");
  const iSched = typesCur.indexOf("TASK_RETRY_SCHEDULED");
  const iDone = typesCur.indexOf("CURSOR_COMPLETED");
  assert(iFail >= 0 && iSched > iFail && iDone > iSched, "cursor retry path should log fail, retry schedule, then completion");

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpReviewForceNonRetryableOnce(baseTasks(pid)[0]!.id);
  const rNonRetry = await startRun(pid);
  assert(rNonRetry.status === "FAILED", "non-retryable review must fail the run without further retries");
  const stNonRetry = await getRunStatus(rNonRetry.id);
  assert(stNonRetry.failureReason?.includes("REVIEW_FAILED"), "failure reason should reference REVIEW_FAILED");
  const stepsNr = mvpGetExecutionStepsForRun(rNonRetry.id);
  const typesNr = stepsNr.map((s) => s.stepType);
  assert(typesNr.includes("REVIEW_FAILED"), "non-retryable path should log REVIEW_FAILED");
  const iRunFail = typesNr.indexOf("RUN_FAILED");
  const iRevFail = typesNr.indexOf("REVIEW_FAILED");
  assert(iRunFail > iRevFail, "RUN_FAILED should follow REVIEW_FAILED in the log");
  assert(!typesNr.includes("TASK_RETRY_SCHEDULED"), "non-retryable review must not schedule task retry");
  const lastFailNr = mvpGetLastFailureStepForRun(rNonRetry.id);
  assert(lastFailNr != null && lastFailNr.status === "FAILURE", "last failure step must exist for failed run");
  const sumFail = await mvpProjectRunSummary(rNonRetry.id);
  assert(sumFail?.runStatus === "FAILED" && sumFail.failedTasks === 1, "summary should reflect failed run");
  assert(sumFail?.lastFailureMessage != null, "summary should surface last failure message");

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpCursorFailNextWaits(DEFAULT_MAX_RETRY_COUNT + 2);
  const r3 = await startRun(pid);
  assert(r3.status === "FAILED", "cursor failures beyond retry budget should fail the run");
  const st3 = await getRunStatus(r3.id);
  assert(st3.failureReason?.includes("CURSOR_FAILED"), "failure reason should mention CURSOR_FAILED");
  assert(mvpGetRetryCountFromSteps(r3.id) === DEFAULT_MAX_RETRY_COUNT, "retry steps should match policy budget");
  const sumCurFail = await mvpProjectRunSummary(r3.id);
  assert(sumCurFail?.failedTasks === 1 && sumCurFail.lastFailureCode === "CURSOR_FAILED", "summary last failure code");

  resetAll();
  mvpSeedProjectTasks(pid, []);
  const ready = await evaluateExecutionReadiness({ projectId: pid });
  assert(ready.isReady === false, "empty explicit seed => not ready");
  assert(ready.blockers.includes("NO_EXECUTABLE_TASKS"), "expected NO_EXECUTABLE_TASKS blocker");

  resetAll();
  mvpSeedProjectTasks(pid, [{ ...baseTasks(pid)[0]!, finalOrder: -1 }]);
  const rNeg = await evaluateExecutionReadiness({ projectId: pid });
  assert(rNeg.isReady === false, "negative finalOrder should not be ready");
  assert(rNeg.blockers.includes("FINAL_ORDER_NEGATIVE"), "expected FINAL_ORDER_NEGATIVE blocker");

  resetAll();
  const ta = `t-a-${pid}`;
  const tb = `t-b-${pid}`;
  mvpSeedProjectTasks(pid, [
    { ...baseTasks(pid)[0]!, status: "DRAFT" },
    { ...baseTasks(pid)[1]! },
  ]);
  const conf = await confirmTask({ taskId: ta, actorId: "actor-1" });
  assert(conf.confirmed === true, "confirmTask should set CONFIRMED when task exists");
  const ord = await reorderTasks({ projectId: pid, orderedTaskIds: [tb, ta] });
  assert(ord.ok === true, "reorderTasks should succeed when ids are a valid permutation");
  const listed = await listAllTasks(pid);
  const byOrder = [...listed].sort((a, b) => a.finalOrder - b.finalOrder).map((t) => t.id);
  assert(byOrder[0] === tb && byOrder[1] === ta, "reorderTasks should update finalOrder in memory");

  resetAll();
  const tidMax = `t-max-retry-${pid}`;
  const ridMax = mvpTestInstallRunAtRetryLimit({ projectId: pid, taskId: tidMax });
  const beforeMax = await getRunStatus(ridMax);
  const stepsBefore = mvpGetExecutionStepsForRun(ridMax);
  assert(beforeMax.tasks[0]!.retryCount === DEFAULT_MAX_RETRY_COUNT, "fixture at max retry");
  await retryTask(ridMax, tidMax);
  const stepsAfter = mvpGetExecutionStepsForRun(ridMax);
  assert(stepsAfter.length === stepsBefore.length, "rejected retryTask must not append step log entries");
  const afterMax = await getRunStatus(ridMax);
  assert(afterMax.tasks[0]!.retryCount === DEFAULT_MAX_RETRY_COUNT, "retryTask must not bypass max retry");
  assert(afterMax.tasks[0]!.status === "FAILED", "task should stay FAILED when retry is rejected");
  assert(afterMax.status === "RUNNING", "synthetic run stays RUNNING for policy-only check");

  resetAll();
  const tidNr = `t-nonretry-retry-${pid}`;
  const ridNr = mvpTestInstallRunWithNonRetryableFailure({ projectId: pid, taskId: tidNr });
  await retryTask(ridNr, tidNr);
  const afterNr = await getRunStatus(ridNr);
  assert(afterNr.tasks[0]!.retryCount === 0, "retryTask must not run after non-retryable failure");
  assert(afterNr.tasks[0]!.status === "FAILED", "task should remain FAILED when manual retry is rejected");
}
