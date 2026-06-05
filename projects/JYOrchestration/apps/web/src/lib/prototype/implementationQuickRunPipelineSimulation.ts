import {
  resolveNextCodeTaskIdAfterCompletion,
  resolveNextQuickRunCodeTaskId,
} from "@/lib/prototype/implementationSelectedCodeTaskSequence";
import {
  listCodeTaskIdsFromPlan,
  resolveCodeTaskTreeSelectAll,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { isTerminalRuntimeState } from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";
import type {
  ImplementationRuntimeBundleView,
  ImplementationRuntimeJobView,
  ImplementationRuntimeRunView,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { RuntimeState } from "@/lib/prototype/implementationRuntimeState";

export type QuickRunPipelineSimulationStep =
  | Readonly<{ readonly kind: "select_all"; readonly codeTaskIds: readonly string[] }>
  | Readonly<{
      readonly kind: "job_started";
      readonly selectedCodeTaskIds: readonly string[];
      readonly headCodeTaskId: string;
    }>
  | Readonly<{
      readonly kind: "code_task_terminal";
      readonly codeTaskId: string;
      readonly runtimeState: RuntimeState;
      readonly nextCodeTaskId: string | null;
    }>
  | Readonly<{
      readonly kind: "job_advanced";
      readonly currentCodeTaskId: string | null;
      readonly createdRunForCodeTaskId: string | null;
    }>
  | Readonly<{ readonly kind: "job_completed"; readonly status: ImplementationRuntimeJobView["status"] }>;

export type QuickRunPipelineSimulationResult = Readonly<{
  readonly selectedCodeTaskIds: readonly string[];
  readonly steps: readonly QuickRunPipelineSimulationStep[];
  readonly finalBundle: ImplementationRuntimeBundleView;
}>;

function runView(input: {
  readonly id: string;
  readonly projectId: string;
  readonly jobId: string;
  readonly codeTaskId: string;
  readonly runtimeState: RuntimeState;
  readonly nowIso: string;
}): ImplementationRuntimeRunView {
  const terminal = isTerminalRuntimeState(input.runtimeState);
  return {
    id: input.id,
    projectId: input.projectId,
    jobId: input.jobId,
    codeTaskId: input.codeTaskId,
    runtimeState: input.runtimeState,
    cursorAgentId: null,
    branchName: null,
    commitSha: terminal ? "sim-commit" : null,
    pullRequestUrl: null,
    failureReason: null,
    lastHeartbeatAt: input.nowIso,
    startedAt: input.nowIso,
    completedAt: terminal ? input.nowIso : null,
    updatedAt: input.nowIso,
  };
}

/** In-memory DB Job + runs (Quick Run 순차 실행 규칙 검증용). */
export function createSimulatedQuickRunJobBundle(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly nowIso?: string;
}): ImplementationRuntimeBundleView {
  const pid = input.projectId.trim();
  const jobId = input.jobId.trim();
  const selected = input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const head = selected[0] ?? null;
  if (!head) {
    return { job: null, runs: [], currentRun: null };
  }
  const firstRun = runView({
    id: `${jobId}-run-0`,
    projectId: pid,
    jobId,
    codeTaskId: head,
    runtimeState: "queued",
    nowIso,
  });
  const job: ImplementationRuntimeJobView = {
    id: jobId,
    projectId: pid,
    status: "running",
    currentCodeTaskId: head,
    selectedCodeTaskIds: selected,
    failureReason: null,
    startedAt: nowIso,
    completedAt: null,
    updatedAt: nowIso,
  };
  return { job, runs: [firstRun], currentRun: firstRun };
}

export function markSimulatedRunTerminal(input: {
  readonly bundle: ImplementationRuntimeBundleView;
  readonly codeTaskId: string;
  readonly runtimeState: RuntimeState;
  readonly nowIso?: string;
}): ImplementationRuntimeBundleView {
  const codeTaskId = input.codeTaskId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const job = input.bundle.job;
  if (!job) return input.bundle;
  let updatedCurrent = input.bundle.currentRun;
  const runs = input.bundle.runs.map((run) => {
    if (run.codeTaskId !== codeTaskId) return run;
    const next = runView({
      id: run.id,
      projectId: run.projectId,
      jobId: run.jobId,
      codeTaskId: run.codeTaskId,
      runtimeState: input.runtimeState,
      nowIso,
    });
    if (job.currentCodeTaskId === codeTaskId) updatedCurrent = next;
    return next;
  });
  return { ...input.bundle, runs, currentRun: updatedCurrent };
}

/** `advanceImplementationRuntimeJob`와 동일한 선택 순서 규칙 (DB mock). */
export function advanceSimulatedQuickRunJob(input: {
  readonly bundle: ImplementationRuntimeBundleView;
  readonly nowIso?: string;
}): Readonly<{
  readonly bundle: ImplementationRuntimeBundleView;
  readonly createdRunForCodeTaskId: string | null;
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const job = input.bundle.job;
  if (!job || job.status !== "running") {
    return { bundle: input.bundle, createdRunForCodeTaskId: null };
  }
  const selected = job.selectedCodeTaskIds;
  const currentCodeTaskId = job.currentCodeTaskId?.trim() ?? "";
  if (!currentCodeTaskId) {
    throw new Error("Job has no currentCodeTaskId");
  }
  const currentRun =
    input.bundle.runs.find((r) => r.codeTaskId === currentCodeTaskId) ?? input.bundle.currentRun;
  if (!currentRun || !isTerminalRuntimeState(currentRun.runtimeState)) {
    throw new Error(
      `Current run must be terminal before advance (state=${currentRun?.runtimeState ?? "missing"})`,
    );
  }
  const currentIndex = selected.indexOf(currentCodeTaskId);
  if (currentIndex < 0) {
    throw new Error(`currentCodeTaskId ${currentCodeTaskId} is not in selectedCodeTaskIds`);
  }
  const nextCodeTaskId = selected[currentIndex + 1];
  if (nextCodeTaskId) {
    const nextRun = runView({
      id: `${job.id}-run-${input.bundle.runs.length}`,
      projectId: job.projectId,
      jobId: job.id,
      codeTaskId: nextCodeTaskId,
      runtimeState: "queued",
      nowIso,
    });
    const updatedJob: ImplementationRuntimeJobView = {
      ...job,
      currentCodeTaskId: nextCodeTaskId,
      updatedAt: nowIso,
    };
    return {
      bundle: {
        job: updatedJob,
        runs: [...input.bundle.runs, nextRun],
        currentRun: nextRun,
      },
      createdRunForCodeTaskId: nextCodeTaskId,
    };
  }
  const completedJob: ImplementationRuntimeJobView = {
    ...job,
    status: "completed",
    currentCodeTaskId: null,
    completedAt: nowIso,
    updatedAt: nowIso,
  };
  return {
    bundle: {
      job: completedJob,
      runs: input.bundle.runs,
      currentRun: null,
    },
    createdRunForCodeTaskId: null,
  };
}

/**
 * 전체 선택 → Job 시작 → 각 CodeTask terminal → advance 반복.
 * continuation API(`resolveNextQuickRunCodeTaskId`)와 advance가 같은 순서를 따르는지 검증한다.
 */
export function simulateSelectAllQuickRunSequentialExecution(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly terminalRuntimeState?: RuntimeState;
  readonly nowIso?: string;
}): QuickRunPipelineSimulationResult {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const terminalState = input.terminalRuntimeState ?? "completed";
  const steps: QuickRunPipelineSimulationStep[] = [];

  const selectedCodeTaskIds = resolveCodeTaskTreeSelectAll({
    selectAll: true,
    codeTaskPlan: input.codeTaskPlan,
  });
  steps.push({ kind: "select_all", codeTaskIds: selectedCodeTaskIds });

  const planOrder = listCodeTaskIdsFromPlan(input.codeTaskPlan);
  if (selectedCodeTaskIds.join(",") !== planOrder.join(",")) {
    throw new Error("select_all order must match plan document order");
  }

  let bundle = createSimulatedQuickRunJobBundle({
    projectId: pid,
    jobId: input.jobId,
    selectedCodeTaskIds,
    nowIso,
  });
  steps.push({
    kind: "job_started",
    selectedCodeTaskIds,
    headCodeTaskId: selectedCodeTaskIds[0]!,
  });

  for (let i = 0; i < selectedCodeTaskIds.length; i += 1) {
    const codeTaskId = selectedCodeTaskIds[i]!;
    if (bundle.job?.currentCodeTaskId !== codeTaskId) {
      throw new Error(
        `Expected current CodeTask ${codeTaskId}, got ${bundle.job?.currentCodeTaskId ?? "null"}`,
      );
    }
    bundle = markSimulatedRunTerminal({
      bundle,
      codeTaskId,
      runtimeState: terminalState,
      nowIso,
    });
    const nextCodeTaskId = resolveNextQuickRunCodeTaskId({
      completedCodeTaskId: codeTaskId,
      dbBundle: bundle,
    });
    const expectedNext = resolveNextCodeTaskIdAfterCompletion({
      selectedCodeTaskIds,
      completedCodeTaskId: codeTaskId,
    });
    if (nextCodeTaskId !== expectedNext) {
      throw new Error(
        `Next mismatch after ${codeTaskId}: resolveNextQuickRun=${nextCodeTaskId} expected=${expectedNext}`,
      );
    }
    steps.push({
      kind: "code_task_terminal",
      codeTaskId,
      runtimeState: terminalState,
      nextCodeTaskId,
    });

    const advanced = advanceSimulatedQuickRunJob({ bundle, nowIso });
    bundle = advanced.bundle;
    steps.push({
      kind: "job_advanced",
      currentCodeTaskId: bundle.job?.currentCodeTaskId ?? null,
      createdRunForCodeTaskId: advanced.createdRunForCodeTaskId,
    });
  }

  if (bundle.job?.status !== "completed") {
    throw new Error(`Job should be completed, got ${bundle.job?.status ?? "null"}`);
  }
  steps.push({ kind: "job_completed", status: "completed" });

  return { selectedCodeTaskIds, steps, finalBundle: bundle };
}
