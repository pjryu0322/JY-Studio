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
import {
  mvpCheckReadinessDto,
  mvpGetRunDetailDto,
  mvpGetRunSummaryDto,
  mvpGetStepFlowSummary,
  mvpGetStepSummaryDtos,
  mvpStartRunIfReady,
} from "./orchestration/mvpOrchestrationFacade";
import {
  mvpExecutionPortsBundle,
  mvpSetExecutionPortsBundleForTesting,
} from "./runtime/mvpExecutionPortsBundle";
import { mvpDefaultTaskProvider } from "./task/taskService";
import { mvpDefaultPromptProvider } from "./prompt/promptService";
import { mvpDefaultCursorExecutor } from "./cursor/cursorService";
import { mvpDefaultGitVerifier } from "./git/gitService";
import { mvpDefaultReviewEngine } from "./reviewer/reviewerService";
import { mvpInMemoryRunStore, mvpInMemoryStepStore } from "./execution/inMemoryExecutionState";
import { mvpCursorResetTestHooks, mvpCursorFailNextWaits } from "./cursor/cursorService";
import { mvpGitResetStubs } from "./git/gitService";
import { createMvpFakeExecutionPortsBundle } from "./testing/mvpFakeExecutionPorts";

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
  mvpSetExecutionPortsBundleForTesting(null);
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
  {
    const b = mvpExecutionPortsBundle();
    assert(b.tasks === mvpDefaultTaskProvider, "bundle.tasks must be default TaskProvider");
    assert(b.prompt === mvpDefaultPromptProvider, "bundle.prompt must be default PromptProvider");
    assert(b.cursor === mvpDefaultCursorExecutor, "bundle.cursor must be default CursorExecutor");
    assert(b.git === mvpDefaultGitVerifier, "bundle.git must be default GitVerifier");
    assert(b.review === mvpDefaultReviewEngine, "bundle.review must be default ReviewEngine");
    assert(b.runStore === mvpInMemoryRunStore, "bundle.runStore must be in-memory RunStore");
    assert(b.stepStore === mvpInMemoryStepStore, "bundle.stepStore must be in-memory StepStore");
  }

  resetAll();
  mvpSeedProjectTasks(pid, []);
  const blocked = await mvpStartRunIfReady(pid);
  assert(blocked.ok === false && blocked.reason === "NOT_READY", "facade must reject start when not ready");
  assert(blocked.readiness.isReady === false, "readiness DTO must reflect blockers");
  assert(blocked.readiness.blockers.length > 0, "not-ready readiness must list blockers");

  resetAll();
  mvpSeedProjectTasks(pid, baseTasks(pid));
  const viaFacade = await mvpStartRunIfReady(pid);
  assert(viaFacade.ok === true, "facade must start when ready");
  const r1 = viaFacade.run;
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
  const dtoOk = await mvpGetRunSummaryDto(r1.id);
  assert(dtoOk?.runStatus === "SUCCESS" && dtoOk.totalStepCount === steps1.length, "facade run summary DTO after success");
  const stepDtosOk = mvpGetStepSummaryDtos(r1.id);
  assert(stepDtosOk.length === steps1.length, "facade step DTOs must match log length");
  assert(
    stepDtosOk.every((d, i) => d.sequence === steps1[i]!.sequence && d.stepType === steps1[i]!.stepType),
    "step DTOs must preserve sequence and type from port-backed log"
  );
  assert(mvpGetStepFlowSummary(r1.id).includes("RUN_SUCCESS"), "step flow summary must mention RUN_SUCCESS");
  const readinessDto = await mvpCheckReadinessDto({ projectId: pid });
  assert(readinessDto.isReady === true && readinessDto.projectId === pid, "readiness DTO should be ready after seed");

  const portSteps = mvpExecutionPortsBundle().stepStore.getStepsForRun(r1.id);
  assert(
    portSteps.length === steps1.length &&
      portSteps.every((s, i) => s.sequence === steps1[i]!.sequence && s.message === steps1[i]!.message),
    "StepStore view must match executionStepLog reader"
  );

  const detailOk = await mvpGetRunDetailDto(r1.id);
  assert(detailOk != null && detailOk.runStatus === "SUCCESS", "run detail DTO after success");
  assert(detailOk.tasks.length === 2 && detailOk.tasks.every((t) => t.status === "SUCCESS"), "detail tasks SUCCESS");
  assert(detailOk.totalStepCount === steps1.length, "detail step count");
  assert(
    detailOk.retrySummary.automaticRetrySteps === 0 && detailOk.retrySummary.totalTaskRetryCount === 0,
    "detail retry summary on happy path"
  );
  assert(detailOk.latestFailurePayload === undefined, "no structured failure payload on success detail");
  assert(
    detailOk.stepFlowSummary != null && detailOk.stepFlowSummary.includes("RUN_SUCCESS"),
    "detail step flow summary"
  );

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
  assert(
    lastFailNr.failurePayload != null &&
      lastFailNr.failurePayload.failureCode === "REVIEW_FAILED" &&
      lastFailNr.failurePayload.sourceStepType === "REVIEW_FAILED",
    "failure step must preserve structured failure payload"
  );
  const sumFail = await mvpProjectRunSummary(rNonRetry.id);
  assert(sumFail?.runStatus === "FAILED" && sumFail.failedTasks === 1, "summary should reflect failed run");
  assert(sumFail?.lastFailureMessage != null, "summary should surface last failure message");
  assert(
    sumFail?.lastFailurePayload?.failureCode === "REVIEW_FAILED" && sumFail.lastFailurePayload.retryable === false,
    "run summary projection must carry structured failure from step"
  );
  const dtoFail = await mvpGetRunSummaryDto(rNonRetry.id);
  assert(
    dtoFail?.runStatus === "FAILED" &&
      dtoFail.lastFailurePayload?.failureCode === "REVIEW_FAILED" &&
      dtoFail.lastFailurePayload.sourceStepType === "REVIEW_FAILED",
    "facade run summary DTO must expose structured failure after failure"
  );
  const stepDtosFail = mvpGetStepSummaryDtos(rNonRetry.id);
  const reviewFailDto = stepDtosFail.find((d) => d.stepType === "REVIEW_FAILED");
  assert(
    reviewFailDto?.failurePayload?.failureCode === "REVIEW_FAILED" && reviewFailDto.failurePayload.retryable === false,
    "step summary DTOs must include failurePayload on failure steps"
  );

  const detailFail = await mvpGetRunDetailDto(rNonRetry.id);
  assert(detailFail != null && detailFail.runStatus === "FAILED", "run detail DTO after failure");
  assert(detailFail.tasks.length === 1 && detailFail.tasks[0]!.status === "FAILED", "detail task FAILED");
  assert(
    detailFail.latestFailurePayload?.failureCode === "REVIEW_FAILED" && detailFail.latestFailurePayload.retryable === false,
    "run detail DTO must preserve structured failure"
  );
  assert(detailFail.totalStepCount === stepsNr.length, "detail step count matches log");
  assert(
    detailFail.stepFlowSummary != null && detailFail.stepFlowSummary.includes("REVIEW_FAILED"),
    "detail flow includes failing step"
  );

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

  resetAll();
  {
    const { bundle: fakeOkBundle, counters: cOk } = createMvpFakeExecutionPortsBundle({ reviewPass: true });
    mvpSetExecutionPortsBundleForTesting(fakeOkBundle);
    mvpResetExecutionState();
    const fakeStart = await mvpStartRunIfReady("mvp-fake-ok-project");
    assert(fakeStart.ok === true, "orchestration must drive execution through injected fake bundle");
    assert(
      cOk.getExecutableTasks >= 1 &&
        cOk.generatePrompt >= 1 &&
        cOk.submitTaskPrompt >= 1 &&
        cOk.waitForCompletion >= 1 &&
        cOk.reviewTaskResult >= 1,
      "fake Task/Prompt/Cursor/Review adapters must be invoked"
    );
    assert(cOk.stepAppend >= 1, "injected StepStore.append must be used");
    const fakeDetail = await mvpGetRunDetailDto(fakeStart.run.id);
    assert(
      fakeDetail?.runStatus === "SUCCESS" && fakeDetail.tasks.length === 1 && fakeDetail.tasks[0]!.taskId === "fake-task-1",
      "fake run detail DTO"
    );
    assert(
      fakeDetail?.totalStepCount === fakeOkBundle.stepStore.getStepsForRun(fakeStart.run.id).length,
      "detail step count must follow injected StepStore"
    );

    const { bundle: fakeEmptyBundle, counters: cEmpty } = createMvpFakeExecutionPortsBundle({
      emptyExecutableSet: true,
    });
    mvpSetExecutionPortsBundleForTesting(fakeEmptyBundle);
    mvpResetExecutionState();
    const fakeBlocked = await mvpStartRunIfReady("mvp-fake-empty");
    assert(fakeBlocked.ok === false && fakeBlocked.reason === "NOT_READY", "facade rejects start when fake tasks empty");
    assert(cEmpty.getExecutableTasks >= 1, "readiness must consult fake TaskProvider");

    const { bundle: fakeFailBundle, counters: cFail } = createMvpFakeExecutionPortsBundle({ reviewPass: false });
    mvpSetExecutionPortsBundleForTesting(fakeFailBundle);
    mvpResetExecutionState();
    const fakeFailStart = await mvpStartRunIfReady("mvp-fake-fail-project");
    assert(fakeFailStart.ok === true && fakeFailStart.run.status === "FAILED", "fake failing review ends run");
    const fakeFailDetail = await mvpGetRunDetailDto(fakeFailStart.run.id);
    assert(
      fakeFailDetail?.latestFailurePayload?.failureCode === "REVIEW_FAILED" &&
        fakeFailDetail.latestFailurePayload.retryable === false,
      "fake failure path must surface structured failure in run detail DTO"
    );
    assert(cFail.reviewTaskResult >= 1, "fake review must run on failure path");
  }
  resetAll();
}
