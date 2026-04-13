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
import type { ExecutionRun } from "./contracts/mvpExecutionTypes";
import {
  mvpResetExecutionState,
  startRun,
  getRunStatus,
  retryTask,
  DEFAULT_MAX_RETRY_COUNT,
} from "./execution/executionService";
import { mvpGetExecutionStepsForRun } from "./execution/executionStepLog";
import type { MvpExecutionStepRecord } from "./execution/executionStepLog";
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
import {
  mergePersistedRunParts,
  mvpPersistedRowToStepRecord,
  mvpStepRecordToPersistedRow,
  persistedMetaRowToRunMeta,
  runMetaToPersistedRow,
  splitExecutionRunForPersistence,
} from "./mapping/mvpPersistenceMapping";
import { MvpDraftPrismaRunStoreAdapter } from "./adapters/draft/mvpDraftPrismaRunStoreAdapter";
import { MvpDraftPrismaStepStoreAdapter } from "./adapters/draft/mvpDraftPrismaStepStoreAdapter";
import { mvpBuildRunInspectionViewModel } from "./orchestration/mvpRunInspectionViewModel";
import {
  MvpExecutionApplicationService,
  MVP_EXECUTION_APPLICATION_LAYER_ID,
} from "../application/mvpExecutionApplicationService";
import { appFailureResult, appSuccessResult } from "../application/mvpAppResultHelpers";
import {
  MVP_EXECUTION_APPLICATION_COMMANDS,
  MVP_EXECUTION_APPLICATION_QUERIES,
} from "../application/mvpExecutionApplicationCqrs";
import {
  MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES,
  routeEnvelopeDraftFromGetReadinessResult,
  routeEnvelopeDraftFromGetRunDetailResult,
  routeEnvelopeDraftFromGetRunInspectionResult,
  routeEnvelopeDraftFromGetRunSummaryResult,
  routeEnvelopeDraftFromGetStepListResult,
  routeEnvelopeDraftFromStartRunResult,
} from "../application/mvpRouteEnvelopeDraft";
import { MVP_EXECUTION_APP_CODE } from "../application/mvpExecutionResultCodes";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(`mvpSelfCheck: ${msg}`);
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
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
    assert(!(b.runStore instanceof MvpDraftPrismaRunStoreAdapter), "default bundle must not use Prisma run draft");
    assert(!(b.stepStore instanceof MvpDraftPrismaStepStoreAdapter), "default bundle must not use Prisma step draft");
  }

  resetAll();
  {
    const readinessProbe = await mvpCheckReadinessDto({ projectId: "mvp-result-helper-probe" });
    const viaHelper = appSuccessResult({ readiness: readinessProbe });
    const literalOk = { ok: true as const, code: MVP_EXECUTION_APP_CODE.OK, readiness: readinessProbe };
    assert(stableJson(viaHelper) === stableJson(literalOk), "appSuccessResult must match literal success contract");
    const fInv = appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID);
    assert(stableJson(fInv) === stableJson({ ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID }));
    const fNr = appFailureResult(MVP_EXECUTION_APP_CODE.NOT_READY, { readiness: readinessProbe });
    assert(
      stableJson(fNr) === stableJson({ ok: false, code: MVP_EXECUTION_APP_CODE.NOT_READY, readiness: readinessProbe }),
      "appFailureResult with extras must match literal"
    );

    assert(MVP_EXECUTION_APPLICATION_COMMANDS.length === 1 && MVP_EXECUTION_APPLICATION_COMMANDS[0] === "startRun");
    for (const q of MVP_EXECUTION_APPLICATION_QUERIES) {
      assert(q !== "startRun", "CQRS: startRun must only be a command");
    }
    assert(
      MVP_EXECUTION_APPLICATION_QUERIES.length === 5 &&
        (["getReadiness", "getRunSummary", "getRunDetail", "getStepList", "getRunInspection"] as const).every((n) =>
          (MVP_EXECUTION_APPLICATION_QUERIES as readonly string[]).includes(n)
        ),
      "CQRS query surface must stay in sync with service methods"
    );

    mvpSeedProjectTasks("mvp-envelope-not-ready", []);
    const appEnv = new MvpExecutionApplicationService();
    const gr = await appEnv.getReadiness({ projectId: "mvp-envelope-not-ready" });
    const envG = routeEnvelopeDraftFromGetReadinessResult(gr);
    assert(
      envG.success === true && gr.ok && stableJson(envG.data) === stableJson({ readiness: gr.readiness }),
      "readiness envelope maps application success"
    );

    const sr = await appEnv.startRun({ projectId: "mvp-envelope-not-ready" });
    assert(sr.ok === false && sr.code === MVP_EXECUTION_APP_CODE.NOT_READY);
    const envS = routeEnvelopeDraftFromStartRunResult(sr);
    assert(
      envS.success === false &&
        "message" in envS &&
        envS.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.NOT_READY],
      "NOT_READY envelope message"
    );
    assert(
      "data" in envS && envS.data != null && stableJson(envS.data) === stableJson({ readiness: sr.readiness }),
      "NOT_READY envelope carries readiness"
    );
  }
  resetAll();

  {
    const sampleRun: ExecutionRun = {
      id: "run-rt",
      projectId: "p-rt",
      status: "RUNNING",
      currentTaskIndex: 1,
      tasks: [
        {
          taskId: "a",
          status: "SUCCESS",
          retryCount: 0,
          lastFailureCode: "REVIEW_FAILED",
          lastFailureMessage: "x",
          lastFailureRetryable: false,
          totalExecuteAttempts: 2,
        },
        { taskId: "b", status: "PENDING", retryCount: 1 },
      ],
    };
    const { run: runRow, tasks: taskRows } = splitExecutionRunForPersistence(sampleRun);
    assert(runRow.id === sampleRun.id && runRow.projectId === sampleRun.projectId && runRow.status === sampleRun.status, "run row keys");
    assert(runRow.currentTaskIndex === sampleRun.currentTaskIndex, "currentTaskIndex preserved");
    assert(taskRows.length === 2 && taskRows[0]!.taskId === "a" && taskRows[1]!.sortOrder === 1, "task rows preserve order");
    const merged = mergePersistedRunParts(runRow, taskRows);
    assert(merged.id === sampleRun.id && merged.tasks.length === sampleRun.tasks.length, "merge restores run");
    assert(merged.tasks[0]!.lastFailureCode === "REVIEW_FAILED" && merged.tasks[0]!.totalExecuteAttempts === 2, "task snapshot fields round-trip");
    assert(merged.tasks[1]!.retryCount === 1 && merged.tasks[1]!.status === "PENDING", "second task preserved");

    const step: MvpExecutionStepRecord = {
      runId: "r1",
      taskId: "t1",
      sequence: 3,
      stepType: "CURSOR_FAILED",
      status: "FAILURE",
      message: "boom",
      timestamp: 1700000000000,
      failurePayload: {
        failureCode: "CURSOR_FAILED",
        failureMessage: "boom",
        retryable: true,
        sourceStepType: "CURSOR_FAILED",
      },
    };
    const persistedStep = mvpStepRecordToPersistedRow(step);
    assert(persistedStep.sequence === 3 && persistedStep.failurePayloadJson != null, "step row carries sequence and JSON");
    const stepBack = mvpPersistedRowToStepRecord(persistedStep);
    assert(
      stepBack.failurePayload?.failureCode === "CURSOR_FAILED" &&
        stepBack.failurePayload.retryable === true &&
        stepBack.stepType === "CURSOR_FAILED",
      "structured failure survives JSON round-trip"
    );

    const metaRow = runMetaToPersistedRow("rid", { failureReason: "TASK_NOT_FOUND:gone" });
    assert(persistedMetaRowToRunMeta(metaRow).failureReason === "TASK_NOT_FOUND:gone", "run meta mapping");

    let draftRunThrew = false;
    try {
      new MvpDraftPrismaRunStoreAdapter().get("x");
    } catch (e) {
      draftRunThrew = e instanceof Error && e.message.includes("NOT_IMPLEMENTED_IN_MVP");
    }
    assert(draftRunThrew, "draft Prisma run adapter must be isolated (throws)");

    let draftStepThrew = false;
    try {
      new MvpDraftPrismaStepStoreAdapter().getStepsForRun("x");
    } catch (e) {
      draftStepThrew = e instanceof Error && e.message.includes("NOT_IMPLEMENTED_IN_MVP");
    }
    assert(draftStepThrew, "draft Prisma step adapter must be isolated (throws)");
  }

  resetAll();
  mvpSeedProjectTasks(pid, []);
  const blocked = await mvpStartRunIfReady(pid);
  assert(blocked.ok === false && blocked.reason === "NOT_READY", "facade must reject start when not ready");
  assert(blocked.readiness.isReady === false, "readiness DTO must reflect blockers");
  assert(blocked.readiness.blockers.length > 0, "not-ready readiness must list blockers");

  {
    assert(
      MVP_EXECUTION_APPLICATION_LAYER_ID === "jyorchestration:application:mvp-execution",
      "application layer id must remain JYOrchestration-scoped (no external package coupling)"
    );
    const app = new MvpExecutionApplicationService();
    const appReadiness = await app.getReadiness({ projectId: pid });
    assert(appReadiness.ok === true && appReadiness.code === MVP_EXECUTION_APP_CODE.OK, "application getReadiness ok shape");
    assert(
      appReadiness.readiness.isReady === false &&
        appReadiness.readiness.blockers.join(",") === blocked.readiness.blockers.join(","),
      "application getReadiness must match MVP facade readiness"
    );
    const appStart = await app.startRun({ projectId: pid });
    assert(
      appStart.ok === false &&
        appStart.code === MVP_EXECUTION_APP_CODE.NOT_READY &&
        appStart.readiness.isReady === false,
      "application startRun must respect readiness (no run when not ready)"
    );
  }

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

  const inspectOk = await mvpBuildRunInspectionViewModel({ projectId: pid, runId: r1.id });
  assert(inspectOk.runId === r1.id && inspectOk.projectId === pid, "inspection keys");
  assert(inspectOk.readiness.isReady === true, "inspection bundles readiness");
  assert(inspectOk.runSummary?.runStatus === "SUCCESS" && inspectOk.runSummary.totalStepCount === steps1.length, "inspection summary");
  assert(inspectOk.runDetail?.tasks.length === 2 && inspectOk.runDetail.runStatus === "SUCCESS", "inspection detail");
  assert(inspectOk.steps.length === steps1.length && inspectOk.stepFlowSummary.includes("RUN_SUCCESS"), "inspection steps + flow");

  {
    const app = new MvpExecutionApplicationService();
    const appSum = await app.getRunSummary({ runId: r1.id });
    assert(appSum.ok === true && appSum.code === MVP_EXECUTION_APP_CODE.OK, "application getRunSummary success code");
    assert(
      appSum.summary.runId === dtoOk?.runId &&
        appSum.summary.runStatus === dtoOk?.runStatus &&
        appSum.summary.totalStepCount === dtoOk?.totalStepCount,
      "application getRunSummary must match facade DTO"
    );
    const appDet = await app.getRunDetail({ runId: r1.id });
    assert(appDet.ok === true && appDet.code === MVP_EXECUTION_APP_CODE.OK, "application getRunDetail success code");
    assert(stableJson(appDet.detail) === stableJson(detailOk), "application getRunDetail JSON parity vs facade");

    const appSteps = await app.getStepList({ runId: r1.id });
    assert(appSteps.ok === true && appSteps.code === MVP_EXECUTION_APP_CODE.OK, "application getStepList success code");
    assert(stableJson(appSteps.steps) === stableJson(stepDtosOk), "application step list JSON parity vs facade");
    assert(appSteps.stepFlowSummary === inspectOk.stepFlowSummary, "application step flow must match facade inspection flow");

    const appInsp = await app.getRunInspection({ projectId: pid, runId: r1.id });
    assert(appInsp.ok === true && appInsp.code === MVP_EXECUTION_APP_CODE.OK, "application getRunInspection success code");
    assert(stableJson(appInsp.inspection) === stableJson(inspectOk), "application getRunInspection JSON parity vs facade VM");
  }

  let threw = false;
  try {
    buildTaskPrompt({ taskId: tid0, projectId: "wrong-project" });
  } catch {
    threw = true;
  }
  assert(threw, "buildTaskPrompt must reject cross-project contract mismatch");

  {
    const pStart = "mvp-app-start-parity";
    resetAll();
    mvpSeedProjectTasks(pStart, baseTasks(pStart));
    const facadeStart = await mvpStartRunIfReady(pStart);
    assert(facadeStart.ok === true, "facade baseline start when ready");
    const summaryViaFacade = await mvpGetRunSummaryDto(facadeStart.run.id);
    resetAll();
    mvpSeedProjectTasks(pStart, baseTasks(pStart));
    const appSvc = new MvpExecutionApplicationService();
    const appStart = await appSvc.startRun({ projectId: pStart });
    assert(
      appStart.ok === true && appStart.code === MVP_EXECUTION_APP_CODE.OK,
      "application startRun when ready must succeed"
    );
    const summaryViaAppRes = await appSvc.getRunSummary({ runId: appStart.runId });
    assert(summaryViaAppRes.ok === true && summaryViaAppRes.code === MVP_EXECUTION_APP_CODE.OK);
    const summaryViaApp = summaryViaAppRes.summary;
    assert(
      summaryViaFacade?.runStatus === summaryViaApp?.runStatus &&
        summaryViaFacade?.totalTasks === summaryViaApp?.totalTasks &&
        summaryViaFacade?.completedTasks === summaryViaApp?.completedTasks &&
        summaryViaFacade?.failedTasks === summaryViaApp?.failedTasks &&
        summaryViaFacade?.totalStepCount === summaryViaApp?.totalStepCount,
      "application startRun path must match MVP facade run outcome (summary parity)"
    );
  }

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

  const inspectFail = await mvpBuildRunInspectionViewModel({ projectId: pid, runId: rNonRetry.id });
  assert(inspectFail.runSummary?.runStatus === "FAILED" && inspectFail.runDetail?.runStatus === "FAILED", "inspection after failure");
  assert(
    inspectFail.runDetail?.latestFailurePayload?.failureCode === "REVIEW_FAILED" &&
      inspectFail.runSummary?.lastFailurePayload?.failureCode === "REVIEW_FAILED",
    "inspection preserves structured failure across summary and detail"
  );
  assert(
    inspectFail.steps.some((s) => s.stepType === "REVIEW_FAILED" && s.failurePayload?.failureCode === "REVIEW_FAILED"),
    "inspection step list carries failure payload"
  );
  assert(inspectFail.stepFlowSummary.includes("REVIEW_FAILED"), "inspection flow includes failure");

  {
    const app = new MvpExecutionApplicationService();
    const appSum = await app.getRunSummary({ runId: rNonRetry.id });
    assert(appSum.ok === true && appSum.code === MVP_EXECUTION_APP_CODE.OK, "application getRunSummary ok on failure run");
    assert(
      appSum.summary.runStatus === "FAILED" && appSum.summary.lastFailurePayload?.failureCode === "REVIEW_FAILED",
      "application summary on failure path"
    );
    assert(stableJson(appSum.summary.lastFailurePayload) === stableJson(dtoFail?.lastFailurePayload), "summary failure payload parity");

    const appDet = await app.getRunDetail({ runId: rNonRetry.id });
    assert(appDet.ok === true && appDet.code === MVP_EXECUTION_APP_CODE.OK, "application getRunDetail ok on failure run");
    assert(
      appDet.detail.runStatus === "FAILED" && appDet.detail.latestFailurePayload?.failureCode === "REVIEW_FAILED",
      "application detail on failure path"
    );
    assert(stableJson(appDet.detail.latestFailurePayload) === stableJson(detailFail?.latestFailurePayload), "detail failure payload parity");

    const appSteps = await app.getStepList({ runId: rNonRetry.id });
    assert(appSteps.ok === true && appSteps.code === MVP_EXECUTION_APP_CODE.OK, "application getStepList ok on failure run");
    assert(stableJson(appSteps.steps) === stableJson(stepDtosFail), "failure step list JSON parity vs facade");
    assert(appSteps.stepFlowSummary === inspectFail.stepFlowSummary, "failure step flow parity vs facade inspection");

    const appInsp = await app.getRunInspection({ projectId: pid, runId: rNonRetry.id });
    assert(appInsp.ok === true && appInsp.code === MVP_EXECUTION_APP_CODE.OK, "application getRunInspection ok on failure run");
    assert(
      appInsp.inspection.runDetail?.latestFailurePayload?.failureCode === "REVIEW_FAILED" &&
        appInsp.inspection.runSummary?.lastFailurePayload?.failureCode === "REVIEW_FAILED",
      "application inspection preserves structured failure"
    );
    assert(stableJson(appInsp.inspection) === stableJson(inspectFail), "failure inspection JSON parity vs facade VM");
  }

  {
    const app = new MvpExecutionApplicationService();
    const badPidReadiness = await app.getReadiness({ projectId: "  \t  " });
    assert(
      badPidReadiness.ok === false && badPidReadiness.code === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "application getReadiness rejects blank projectId"
    );
    const envBadPid = routeEnvelopeDraftFromGetReadinessResult(badPidReadiness);
    assert(
      envBadPid.success === false &&
        envBadPid.appCode === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID &&
        envBadPid.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID],
      "envelope maps INVALID_PROJECT_ID from getReadiness"
    );
    const badPidStart = await app.startRun({ projectId: "" });
    assert(
      badPidStart.ok === false && badPidStart.code === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "application startRun rejects blank projectId"
    );
    const badRid = await app.getRunSummary({ runId: " \n " });
    assert(badRid.ok === false && badRid.code === MVP_EXECUTION_APP_CODE.INVALID_RUN_ID, "application rejects blank runId");
    const envBadRid = routeEnvelopeDraftFromGetRunSummaryResult(badRid);
    assert(
      envBadRid.success === false &&
        envBadRid.appCode === MVP_EXECUTION_APP_CODE.INVALID_RUN_ID &&
        envBadRid.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.INVALID_RUN_ID],
      "envelope maps INVALID_RUN_ID from getRunSummary"
    );
    const missingRun = await app.getRunSummary({ runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingRun.ok === false && missingRun.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application maps unknown run to RUN_NOT_FOUND"
    );
    const envMissSum = routeEnvelopeDraftFromGetRunSummaryResult(missingRun);
    assert(
      envMissSum.success === false &&
        envMissSum.appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND &&
        envMissSum.message === MVP_ROUTE_ENVELOPE_DRAFT_MESSAGES[MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND],
      "envelope maps RUN_NOT_FOUND from getRunSummary"
    );
    const missingDetail = await app.getRunDetail({ runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingDetail.ok === false && missingDetail.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application getRunDetail RUN_NOT_FOUND"
    );
    const envMissDet = routeEnvelopeDraftFromGetRunDetailResult(missingDetail);
    assert(
      envMissDet.success === false && envMissDet.appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "envelope maps RUN_NOT_FOUND from getRunDetail"
    );
    const missingSteps = await app.getStepList({ runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingSteps.ok === false && missingSteps.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application getStepList RUN_NOT_FOUND"
    );
    assert(
      routeEnvelopeDraftFromGetStepListResult(missingSteps).appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "envelope maps RUN_NOT_FOUND from getStepList"
    );
    const missingInsp = await app.getRunInspection({ projectId: pid, runId: "mvp-nonexistent-run-id-00000000" });
    assert(
      missingInsp.ok === false && missingInsp.code === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "application getRunInspection RUN_NOT_FOUND"
    );
    assert(
      routeEnvelopeDraftFromGetRunInspectionResult(missingInsp).appCode === MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND,
      "envelope maps RUN_NOT_FOUND from getRunInspection"
    );
    const badInspPid = await app.getRunInspection({ projectId: "", runId: rNonRetry.id });
    assert(
      badInspPid.ok === false && badInspPid.code === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "application getRunInspection rejects blank projectId"
    );
    assert(
      routeEnvelopeDraftFromGetRunInspectionResult(badInspPid).appCode === MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID,
      "envelope maps INVALID_PROJECT_ID from getRunInspection"
    );
  }

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
