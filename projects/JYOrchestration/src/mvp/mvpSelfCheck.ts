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
import { clearPromptCache } from "./prompt/promptService";
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
  mvpTestInstallRunAtRetryLimit,
  mvpTestInstallRunWithNonRetryableFailure,
  DEFAULT_MAX_RETRY_COUNT,
} from "./execution/executionService";
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

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpReviewForceNonRetryableOnce(baseTasks(pid)[0]!.id);
  const rNonRetry = await startRun(pid);
  assert(rNonRetry.status === "FAILED", "non-retryable review must fail the run without further retries");
  const stNonRetry = await getRunStatus(rNonRetry.id);
  assert(stNonRetry.failureReason?.includes("REVIEW_FAILED"), "failure reason should reference REVIEW_FAILED");

  resetAll();
  mvpSeedProjectTasks(pid, [baseTasks(pid)[0]!]);
  mvpCursorFailNextWaits(DEFAULT_MAX_RETRY_COUNT + 2);
  const r3 = await startRun(pid);
  assert(r3.status === "FAILED", "cursor failures beyond retry budget should fail the run");
  const st3 = await getRunStatus(r3.id);
  assert(st3.failureReason?.includes("CURSOR_FAILED"), "failure reason should mention CURSOR_FAILED");

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
  assert(beforeMax.tasks[0]!.retryCount === DEFAULT_MAX_RETRY_COUNT, "fixture at max retry");
  await retryTask(ridMax, tidMax);
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
