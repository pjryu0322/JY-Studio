/**
 * Deterministic in-process checks for the isolated MVP stack (no routes, no DB).
 * Import and call `runMvpSelfCheck()` from tests or a one-off script under src/mvp only.
 */

import { mvpClearTaskStore, mvpSeedProjectTasks, type Task } from "./task/taskService";
import { clearPromptCache } from "./prompt/promptService";
import { mvpClearReviewPolicy, mvpConfigureReviewFailures } from "./reviewer/reviewerService";
import { mvpResetExecutionState, startRun, getRunStatus, DEFAULT_MAX_RETRY_COUNT } from "./execution/executionService";
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
}
