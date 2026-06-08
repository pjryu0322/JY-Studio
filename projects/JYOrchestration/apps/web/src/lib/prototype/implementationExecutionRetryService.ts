import {
  appendCodeTaskExecutionRun,
  createCodeTaskExecutionRun,
  coalesceCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildCodeTaskRetryBlockedLogEntry,
  buildCodeTaskRetryPrepareFailedLogEntry,
  buildCodeTaskRetryPreparedLogEntry,
} from "@/lib/prototype/implementationExecutionLogger";
import { mergeExecutionUnitWithTerminalGuard } from "@/lib/prototype/implementationExecutionUnitTerminalGuard";
import {
  loadImplementationExecutionUnitsFromState,
  saveImplementationExecutionUnitsToState,
} from "@/lib/prototype/implementationExecutionUnitStore";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function prepareFailedExecutionUnitRetry(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly codeTaskId: string;
  readonly nowIso?: string;
}): Readonly<{
  readonly ok: boolean;
  readonly userMessage?: string;
  readonly orchestrationPatch?: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const codeTaskId = input.codeTaskId.trim();
  const units = loadImplementationExecutionUnitsFromState(input.requirementsState);
  const unit = units.find((u) => u.codeTaskId === codeTaskId) ?? null;
  const runs = coalesceCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1);
  const outcome = unit
    ? resolveAuthoritativeCodeTaskOutcome({ unit, runs })
    : null;

  if (!unit || outcome?.status !== "failed") {
    return {
      ok: false,
      userMessage: "재실행할 실패 작업을 찾을 수 없습니다.",
      timeline: [
        buildCodeTaskRetryPrepareFailedLogEntry({
          projectId: pid,
          codeTaskId,
          reason: "failed_unit_not_found",
          nowIso,
        }),
      ],
    };
  }

  if (unit.retryable === false) {
    return {
      ok: false,
      userMessage: "자동 재실행이 어려운 실패입니다.\n실행 로그를 확인한 뒤 다시 시도해 주세요.",
      timeline: [
        buildCodeTaskRetryBlockedLogEntry({
          projectId: pid,
          reason: "unit_not_retryable",
          unitId: unit.unitId,
          codeTaskId,
          runId: outcome.latestRunId,
          nowIso,
        }),
      ],
    };
  }

  const retryTransition = mergeExecutionUnitWithTerminalGuard({
    current: unit,
    patch: {
      status: "ready",
      runId: null,
      errorCode: null,
      errorMessage: null,
      failedAt: null,
    },
    reason: "implementation_execution_unit_retry",
  });
  if (retryTransition.blocked) {
    return {
      ok: false,
      userMessage: "자동 재실행이 어려운 실패입니다.\n실행 로그를 확인한 뒤 다시 시도해 주세요.",
      timeline: [
        buildCodeTaskRetryBlockedLogEntry({
          projectId: pid,
          reason: "terminal_guard_blocked_retry",
          unitId: unit.unitId,
          codeTaskId,
          runId: outcome.latestRunId,
          nowIso,
        }),
      ],
    };
  }

  const nextUnits = units.map((u) => (u.unitId === unit.unitId ? retryTransition.unit : u));
  const unitPatch = saveImplementationExecutionUnitsToState({
    projectId: pid,
    units: nextUnits,
    reason: "implementation_execution_unit_retry",
    nowIso,
    mergeTerminalGuardFrom: units,
  });

  const newRun = createCodeTaskExecutionRun({
    projectId: pid,
    processTaskId: unit.processTaskId,
    workItemId: unit.sourceWorkItemId ?? "retry",
    codeTaskId,
    runs,
  });
  const mergedRuns = appendCodeTaskExecutionRun(runs, newRun);

  const timeline: RequirementsPromptTimelineEntry[] = [
    buildCodeTaskRetryPreparedLogEntry({
      projectId: pid,
      codeTaskId,
      unitId: unit.unitId,
      previousOutcomeStatus: outcome.latestOutcomeStatus,
      previousReason: outcome.failureReason,
      runId: newRun.runId,
      nowIso,
    }),
  ];

  return {
    ok: true,
    userMessage: "실패 작업 재실행을 준비했습니다.",
    orchestrationPatch: {
      ...unitPatch,
      codeTaskExecutionRunsV1: mergedRuns,
    },
    timeline,
  };
}
