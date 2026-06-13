/** Persisted ExecutionUnit[] is the implementation-stage runtime source of truth (P3-M69). */

import type { CodeTaskGithubOutcomeV1 } from "@/lib/prototype/codeTaskGithubOutcome";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  resolveNextExecutableUnit,
  type ResolveNextExecutableUnitResultV1,
} from "@/lib/prototype/implementationExecutionScheduler";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  buildExecutionUnitsFromLegacyState,
  realignExecutionUnitsWithCodeTaskRuns,
  type BuildExecutionUnitsAuditV1,
} from "@/lib/prototype/implementationExecutionUnitBuilder";
import {
  evaluateExecutionUnitGithubVerifyOutcome,
} from "@/lib/prototype/implementationExecutionUnitGitHubVerify";
import {
  mergeExecutionUnitWithTerminalGuard,
} from "@/lib/prototype/implementationExecutionUnitTerminalGuard";
import {
  loadImplementationExecutionUnitsFromState,
  saveImplementationExecutionUnitsToState,
} from "@/lib/prototype/implementationExecutionUnitStore";
import { reconcileImplementationExecutionSelectedUnits } from "@/lib/prototype/implementationExecutionSelectedUnits";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export type EnsurePersistedExecutionUnitsResultV1 = Readonly<{
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly bootstrapped: boolean;
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
  readonly audit?: BuildExecutionUnitsAuditV1;
}>;

/** legacy_bootstrap_only — creates units when persisted state is missing (once). */
export function ensurePersistedImplementationExecutionUnits(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly workItemCount?: number;
  readonly nowIso?: string;
  readonly forceRebuildExecutionUnits?: boolean;
}): EnsurePersistedExecutionUnitsResultV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const persisted = loadImplementationExecutionUnitsFromState(input.requirementsState);
  if (persisted.length && !input.forceRebuildExecutionUnits) {
    const timeline: RequirementsPromptTimelineEntry[] = [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_units_bootstrap_skipped",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          reason: "persisted_units_exist",
          persistedUnitCount: persisted.length,
        },
        nowIso,
      }),
    ];
    return { units: persisted, bootstrapped: false, orchestrationPatch: {}, timeline };
  }

  const { units, audit } = buildExecutionUnitsFromLegacyState({
    projectId: pid,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    runs: input.runs,
    workItemCount: input.workItemCount,
  });

  const orchestrationPatch = saveImplementationExecutionUnitsToState({
    projectId: pid,
    units,
    reason: "implementation_execution_units_bootstrapped_from_legacy",
    nowIso,
  });

  const timeline: RequirementsPromptTimelineEntry[] = [
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_execution_units_bootstrapped_from_legacy",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: pid,
        unitCount: audit.unitCount,
        codeTaskCount: audit.codeTaskCount,
        workItemCount: audit.workItemCount,
        excludedPseudoCount: audit.excludedPseudoCount,
      },
      nowIso,
    }),
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_execution_units_persisted",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: { projectId: pid, unitCount: units.length, reason: "bootstrap_from_legacy" },
      nowIso,
    }),
  ];

  return { units, bootstrapped: true, orchestrationPatch, timeline, audit };
}

export function resolveQuickRunExecutionContextFromPersisted(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly workItemCount?: number;
}): Readonly<{
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
  readonly next: ResolveNextExecutableUnitResultV1;
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const ensured = ensurePersistedImplementationExecutionUnits({
    projectId: input.projectId,
    requirementsState: input.requirementsState,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    runs: input.runs,
    workItemCount: input.workItemCount,
  });

  const realigned = realignExecutionUnitsWithCodeTaskRuns({
    units: ensured.units,
    runs: input.runs,
    reason: "execution_unit_realign_from_runs",
  });
  let unitsForSchedule = realigned.units;
  let realignPatch: Partial<RequirementsStateJson> = {};
  const realignTimeline: RequirementsPromptTimelineEntry[] = [];
  if (realigned.realignedUnitIds.length) {
    realignPatch = saveImplementationExecutionUnitsToState({
      projectId: input.projectId,
      units: realigned.units,
      reason: "execution_unit_realign_from_runs",
      selectedExecutionUnitIds:
        input.requirementsState?.implementationExecutionUnitsV1?.selectedExecutionUnitIds ?? [],
      nowIso: new Date().toISOString(),
      mergeTerminalGuardFrom: ensured.units,
    });
    realignTimeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_units_realigned_from_runs",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: input.projectId,
          realignedCount: realigned.realignedUnitIds.length,
          unitIds: realigned.realignedUnitIds.join(","),
        },
        nowIso: new Date().toISOString(),
      }),
    );
  }

  const dbSelected =
    input.dbBundle?.job?.selectedCodeTaskIds?.map((id) => id.trim()).filter(Boolean) ?? [];
  const legacySelectedCodeTaskIds = input.selectedCodeTaskIds?.length
    ? input.selectedCodeTaskIds
    : dbSelected.length
      ? dbSelected
      : undefined;

  const mergedState = {
    ...(input.requirementsState ?? {}),
    ...ensured.orchestrationPatch,
    ...realignPatch,
  } as RequirementsStateJson;

  const selection = reconcileImplementationExecutionSelectedUnits({
    projectId: input.projectId,
    state: mergedState,
    units: unitsForSchedule,
    legacySelectedCodeTaskIds,
  });

  const selectedUnitIds = selection.selectedUnitIds;
  const next = resolveNextExecutableUnit({ units: unitsForSchedule, selectedUnitIds });

  const orchestrationPatch = {
    ...ensured.orchestrationPatch,
    ...realignPatch,
    ...selection.orchestrationPatch,
  };
  const timeline = [...ensured.timeline, ...realignTimeline, ...selection.timeline];

  return {
    units: unitsForSchedule,
    selectedUnitIds,
    next,
    orchestrationPatch,
    timeline,
  };
}

export function findExecutionUnitByCodeTaskId(
  units: readonly ImplementationExecutionUnitV1[],
  codeTaskId: string,
): ImplementationExecutionUnitV1 | null {
  const id = codeTaskId.trim();
  return units.find((u) => u.codeTaskId === id || u.unitId === id) ?? null;
}

export function buildExecutionUnitStartedPatch(input: {
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly unitId: string;
  readonly runId: string;
  readonly beforeHeadSha?: string | null;
  readonly nowIso?: string;
}): Readonly<{
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const units = loadImplementationExecutionUnitsFromState(input.state);
  const idx = units.findIndex((u) => u.unitId === input.unitId.trim());
  if (idx < 0) return { orchestrationPatch: {}, timeline: [] };
  const unit = units[idx]!;
  const startedPatch = {
    status: "running" as const,
    runId: input.runId,
    startedAt: nowIso,
    beforeHeadSha: input.beforeHeadSha ?? unit.beforeHeadSha ?? null,
  };
  const guarded = mergeExecutionUnitWithTerminalGuard({
    current: unit,
    patch: startedPatch,
    reason: "implementation_execution_unit_started",
  });
  const nextUnits = [...units];
  nextUnits[idx] = guarded.unit;
  const orchestrationPatch = saveImplementationExecutionUnitsToState({
    projectId: input.projectId,
    units: nextUnits,
    reason: "implementation_execution_unit_started",
    selectedExecutionUnitIds: input.state.implementationExecutionUnitsV1?.selectedExecutionUnitIds ?? [],
    nowIso,
    mergeTerminalGuardFrom: units,
  });
  const timeline = [
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_execution_unit_started",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: input.projectId,
        unitId: unit.unitId,
        codeTaskId: unit.codeTaskId,
        processTaskId: unit.processTaskId,
        workBranch: unit.workBranch,
        runId: input.runId,
        status: "running",
      },
      nowIso,
    }),
  ];
  return { orchestrationPatch, timeline };
}

export function buildExecutionUnitGithubVerifyPatch(input: {
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly githubOutcome: CodeTaskGithubOutcomeV1;
  readonly run: CodeTaskExecutionRunV1;
  readonly nowIso?: string;
}): Readonly<{
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const units = loadImplementationExecutionUnitsFromState(input.state);
  const unit = findExecutionUnitByCodeTaskId(units, input.codeTaskId);
  if (!unit) return { orchestrationPatch: {}, timeline: [] };

  const beforeHeadSha =
    unit.beforeHeadSha ??
    (input.githubOutcome.status === "verified" ? input.githubOutcome.baseHeadSha : null) ??
    input.run.baseCommitSha ??
    null;
  const afterHeadSha =
    input.githubOutcome.status === "verified"
      ? input.githubOutcome.headSha ?? input.githubOutcome.commitSha
      : input.run.branchHeadCommitSha ?? null;

  const evaluation = evaluateExecutionUnitGithubVerifyOutcome({
    beforeHeadSha,
    afterHeadSha,
    noCodeChangeEvidence: input.run.noCodeChangeEvidence ?? null,
  });

  const idx = units.findIndex((u) => u.unitId === unit.unitId);
  const nextUnits = [...units];
  let patched: ImplementationExecutionUnitV1;

  if (evaluation.status === "failed_commit_not_created" || input.githubOutcome.status === "failed") {
    patched = {
      ...unit,
      status: "failed",
      failedAt: nowIso,
      retryable: input.githubOutcome.status === "failed" ? input.githubOutcome.retryable !== false : true,
      errorCode:
        input.githubOutcome.status === "failed"
          ? input.githubOutcome.reason
          : evaluation.reason,
      errorMessage:
        input.githubOutcome.status === "failed"
          ? input.githubOutcome.message ?? null
          : evaluation.reason,
      afterHeadSha: afterHeadSha ?? unit.afterHeadSha ?? null,
      beforeHeadSha,
    };
  } else {
    patched = {
      ...unit,
      status: "verified",
      verifiedAt: nowIso,
      afterHeadSha: evaluation.afterHeadSha,
      commitSha: evaluation.commitSha,
      beforeHeadSha,
      errorCode: null,
      errorMessage: null,
    };
  }

  nextUnits[idx] = patched;
  const orchestrationPatch = saveImplementationExecutionUnitsToState({
    projectId: input.projectId,
    units: nextUnits,
    reason:
      patched.status === "verified"
        ? "implementation_execution_unit_verified"
        : "implementation_execution_unit_failed",
    selectedExecutionUnitIds: input.state.implementationExecutionUnitsV1?.selectedExecutionUnitIds ?? [],
    nowIso,
    mergeTerminalGuardFrom: units,
  });

  const timeline: RequirementsPromptTimelineEntry[] = [
    buildImplementationExecutionLogTimelineEntry({
      action:
        patched.status === "verified"
          ? "implementation_execution_unit_verified"
          : "implementation_execution_unit_failed",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: input.projectId,
        unitId: patched.unitId,
        codeTaskId: patched.codeTaskId,
        processTaskId: patched.processTaskId,
        workBranch: patched.workBranch,
        order: patched.order,
        branchGroup: patched.branchGroup,
        status: patched.status,
        beforeHeadSha: patched.beforeHeadSha,
        afterHeadSha: patched.afterHeadSha,
        commitSha: patched.commitSha,
        runId: patched.runId,
      },
      nowIso,
    }),
  ];

  return { orchestrationPatch, timeline };
}

export function buildExecutionUnitVerifyingPatch(input: {
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly nowIso?: string;
}): Readonly<{
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const units = loadImplementationExecutionUnitsFromState(input.state);
  const unit = findExecutionUnitByCodeTaskId(units, input.codeTaskId);
  if (!unit || unit.status === "verifying" || unit.status === "verified") {
    return { orchestrationPatch: {}, timeline: [] };
  }
  const idx = units.findIndex((u) => u.unitId === unit.unitId);
  const nextUnits = [...units];
  const verifyingPatch = { ...unit, status: "verifying" as const, verifyingAt: nowIso };
  const guarded = mergeExecutionUnitWithTerminalGuard({
    current: unit,
    patch: verifyingPatch,
    reason: "implementation_execution_unit_verifying",
  });
  nextUnits[idx] = guarded.unit;
  const orchestrationPatch = saveImplementationExecutionUnitsToState({
    projectId: input.projectId,
    units: nextUnits,
    selectedExecutionUnitIds: input.state.implementationExecutionUnitsV1?.selectedExecutionUnitIds ?? [],
    reason: "implementation_execution_unit_verifying",
    nowIso,
    mergeTerminalGuardFrom: units,
  });
  return {
    orchestrationPatch,
    timeline: [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_unit_verifying",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: input.projectId,
          unitId: unit.unitId,
          codeTaskId: unit.codeTaskId,
        },
        nowIso,
      }),
    ],
  };
}

export function shouldPersistHasNextQuickRunDispatch(input: {
  readonly requirementsState: RequirementsStateJson;
  readonly projectId: string;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
}): boolean {
  const ctx = resolveQuickRunExecutionContextFromPersisted(input);
  return ctx.next.status !== "complete" && ctx.next.status !== "empty_selection";
}

export function countRemainingSelectedExecutionUnits(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
}): number {
  const selected = new Set(input.selectedUnitIds);
  return input.units.filter(
    (u) => selected.has(u.unitId) && u.status !== "verified" && u.status !== "skipped",
  ).length;
}
