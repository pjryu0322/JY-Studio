import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  mapAuthoritativeOutcomeToVerificationDisplayStatus,
  resolveAuthoritativeCodeTaskOutcome,
  type AuthoritativeCodeTaskOutcomeStatusV1,
} from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { formatExecutionUnitVerificationCardLabels } from "@/lib/prototype/implementationExecutionUnitVerification";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { findIntegrationStep } from "@/lib/prototype/implementationIntegrationStepMutations";
import { isPreviewRuntimeOpenReady } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import type {
  ImplementationRuntimeSnapshotV1,
  ImplementationRuntimeUnitDisplayStatusV1,
} from "@/lib/prototype/implementationRuntimeSnapshot";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { coalesceCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  loadImplementationExecutionUnitsFromState,
} from "@/lib/prototype/implementationExecutionUnitStore";
import { loadImplementationIntegrationStepsFromState } from "@/lib/prototype/implementationIntegrationStepStore";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import { loadPersistedSelectedExecutionUnitIds } from "@/lib/prototype/implementationExecutionSelectedUnits";
import { reconcileSelectedExecutionUnitIds } from "@/lib/prototype/implementationExecutionScheduler";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

function mapOutcomeToRuntimeDisplayStatus(
  status: AuthoritativeCodeTaskOutcomeStatusV1,
): ImplementationRuntimeUnitDisplayStatusV1 {
  switch (status) {
    case "verified":
      return "verified";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "inconsistent":
      return "verification_inconsistent";
    case "running":
      return "running";
    case "verifying":
      return "verifying";
    default:
      return "pending";
  }
}

/** Persisted steps first; otherwise branch-plan bootstrap (snapshot-only, no persist). */
export function resolveIntegrationStepsForRuntimeSnapshot(input: {
  readonly requirementsState?: RequirementsStateJson | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
}): readonly ImplementationIntegrationStepV1[] {
  const persisted = loadImplementationIntegrationStepsFromState(input.requirementsState);
  if (persisted.length) return persisted;
  const plan =
    input.codeTaskPlan ??
    parseImplementationCodeTaskPlanV1(input.requirementsState?.implementationCodeTaskPlanV1) ??
    null;
  return buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: plan });
}

function stepStatusLabel(status: ImplementationIntegrationStepV1["status"]): string {
  switch (status) {
    case "pending":
      return "대기";
    case "ready":
      return "실행 가능";
    case "running":
      return "실행 중";
    case "completed":
      return "완료";
    case "failed":
      return "실패";
    case "skipped":
      return "건너뜀";
    default:
      return status;
  }
}

function buildPreviewMessage(snapshot: Pick<ImplementationRuntimeSnapshotV1, "codeTask" | "integration" | "preview">): string {
  const { codeTask, integration, preview } = snapshot;
  if (preview.integratedAppPreviewReady) {
    return "실제 앱 Preview 준비 완료";
  }
  if (codeTask.selected > 0 && (codeTask.completed < codeTask.selected || codeTask.inconsistent > 0)) {
    return `개발 CodeTask ${codeTask.completed}/${codeTask.selected} 완료\n미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.`;
  }
  if (integration.finalWiringStatus !== "completed") {
    return `개발 CodeTask ${codeTask.completed}/${codeTask.selected} 완료\n통합 단계: 최종 연결/통합 Wiring 대기`;
  }
  if (integration.buildStatus !== "completed") {
    return "통합 단계: Build 검증 대기";
  }
  if (integration.appPreviewTargetStatus !== "completed") {
    return "통합 단계: App Preview Target 대기";
  }
  if (integration.integrationBranchStatus !== "completed") {
    return "통합 단계: 통합 branch 대기";
  }
  return preview.message;
}

export function buildImplementationRuntimeSnapshot(input: {
  readonly projectId: string;
  readonly executionUnits: readonly ImplementationExecutionUnitV1[];
  readonly selectedExecutionUnitIds: readonly string[];
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[];
  readonly integrationSteps: readonly ImplementationIntegrationStepV1[];
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly codeTaskPlanCount?: number | null;
  readonly branchPlanIntegrationCount?: number | null;
}): ImplementationRuntimeSnapshotV1 {
  const pid = input.projectId.trim();
  const units = [...input.executionUnits];
  const unitById = new Map(units.map((u) => [u.unitId, u]));
  const { selectedUnitIds: reconciledSelected, removedIds } = reconcileSelectedExecutionUnitIds({
    selectedUnitIds: input.selectedExecutionUnitIds,
    units,
  });
  const selectedSet = new Set(reconciledSelected);
  const selectedUnits = units.filter((u) => selectedSet.has(u.unitId));

  const warnings: string[] = [];
  if (removedIds.length) {
    warnings.push("selected_units_not_found");
  }
  if (
    input.codeTaskPlanCount != null &&
    input.codeTaskPlanCount > 0 &&
    input.codeTaskPlanCount !== units.length
  ) {
    warnings.push("code_task_plan_count_mismatch");
  }

  const runsByCodeTask = new Map<string, number>();
  for (const run of input.codeTaskRuns) {
    const id = run.codeTaskId.trim();
    if (!id) continue;
    runsByCodeTask.set(id, (runsByCodeTask.get(id) ?? 0) + 1);
  }
  for (const [codeTaskId, count] of runsByCodeTask) {
    if (count > 1) warnings.push(`multiple_latest_runs_for_unit:${codeTaskId}`);
  }

  const snapshotUnits = units.map((unit) => {
    const outcome = resolveAuthoritativeCodeTaskOutcome({
      unit,
      runs: input.codeTaskRuns,
    });
    const displayStatus = mapOutcomeToRuntimeDisplayStatus(outcome.status);
    const verification = mapAuthoritativeOutcomeToVerificationDisplayStatus(outcome.status);
    const card = formatExecutionUnitVerificationCardLabels(verification);
    return {
      unitId: unit.unitId,
      codeTaskId: unit.codeTaskId,
      processTaskId: unit.processTaskId,
      title: unit.title,
      order: unit.order,
      branchGroup: unit.branchGroup,
      baseBranch: unit.baseBranch,
      workBranch: unit.workBranch,
      rawStatus: unit.status,
      displayStatus,
      hasPersistedGithubOutcome: outcome.hasPersistedGithubOutcome,
      latestRunId: outcome.latestRunId,
      latestCommitSha: outcome.commitSha,
      statusLabel: card.statusLabel,
      progressLabel: card.progressLabel,
      userSafeFailureTitle: outcome.status === "failed" ? outcome.userSafeTitle : null,
      userSafeFailureMessage: outcome.status === "failed" ? outcome.userSafeMessage : null,
      userSafeFailureReasonLine: outcome.status === "failed" ? outcome.userSafeReasonLine : null,
      userSafeFailureNextActionLine: outcome.status === "failed" ? outcome.userSafeNextActionLine : null,
      userActionLabel: outcome.userActionLabel,
      retryable: unit.retryable !== false,
    };
  });

  const unitByCodeTaskId = new Map(snapshotUnits.map((u) => [u.codeTaskId, u]));

  let completed = 0;
  let running = 0;
  let verifying = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  let inconsistent = 0;
  const pendingCodeTaskIds: string[] = [];
  const inconsistentCodeTaskIds: string[] = [];

  for (const unit of selectedUnits) {
    const row = unitByCodeTaskId.get(unit.codeTaskId);
    if (!row) continue;
    switch (row.displayStatus) {
      case "verified":
        completed += 1;
        break;
      case "skipped":
        skipped += 1;
        completed += 1;
        break;
      case "verification_inconsistent":
        inconsistent += 1;
        inconsistentCodeTaskIds.push(unit.codeTaskId);
        break;
      case "running":
        running += 1;
        pendingCodeTaskIds.push(unit.codeTaskId);
        break;
      case "verifying":
        verifying += 1;
        pendingCodeTaskIds.push(unit.codeTaskId);
        break;
      case "failed":
        failed += 1;
        pendingCodeTaskIds.push(unit.codeTaskId);
        break;
      default:
        pending += 1;
        pendingCodeTaskIds.push(unit.codeTaskId);
        break;
    }
  }

  const currentRunning = selectedUnits.find((u) => u.status === "running");
  const currentVerifying = selectedUnits.find((u) => u.status === "verifying");
  const currentPending = selectedUnits.find((u) => {
    const row = unitByCodeTaskId.get(u.codeTaskId);
    return row && row.displayStatus === "pending";
  });
  const currentUnit = currentRunning ?? currentVerifying ?? currentPending ?? null;

  const integrationSteps = [...input.integrationSteps].sort((a, b) => a.order - b.order);
  const stepRows = integrationSteps.map((step) => ({
    stepId: step.stepId,
    kind: step.kind,
    title: step.title,
    status: step.status,
    statusLabel: stepStatusLabel(step.status),
  }));

  const finalWiring = findIntegrationStep(integrationSteps, "final_wiring");
  const integrationBranch = findIntegrationStep(integrationSteps, "integration_branch");
  const build = findIntegrationStep(integrationSteps, "build");
  const appPreview = findIntegrationStep(integrationSteps, "app_preview_target");

  const finalWiringStatus = finalWiring?.status ?? "missing";
  const integrationBranchStatus = integrationBranch?.status ?? "pending";
  const buildStatus = build?.status ?? "pending";
  const appPreviewTargetStatus = appPreview?.status ?? "pending";

  const selected = selectedUnits.length;
  const total = units.length;
  const codetasksDone =
    selected > 0 &&
    completed === selected &&
    failed === 0 &&
    inconsistent === 0 &&
    pendingCodeTaskIds.length === 0;

  const canRunIntegration =
    selected > 0 &&
    completed === selected &&
    failed === 0 &&
    inconsistent === 0 &&
    Boolean(finalWiring) &&
    (finalWiringStatus === "pending" ||
      finalWiringStatus === "ready" ||
      finalWiringStatus === "failed");

  const previewUrl =
    String(input.previewRuntime?.previewUrl ?? "").trim() ||
    String(input.previewRuntime?.internalAppPreviewUrl ?? "").trim() ||
    null;

  const integratedAppPreviewReady =
    codetasksDone &&
    finalWiringStatus === "completed" &&
    integrationBranchStatus === "completed" &&
    buildStatus === "completed" &&
    appPreviewTargetStatus === "completed" &&
    (isPreviewRuntimeOpenReady(input.previewRuntime) || Boolean(previewUrl));

  const codeTaskPreviewReady = completed > 0 || isPreviewRuntimeOpenReady(input.previewRuntime);

  let nextRequiredStep: ImplementationRuntimeSnapshotV1["integration"]["nextRequiredStep"] = null;
  if (!codetasksDone) nextRequiredStep = "codetask_completion";
  else if (finalWiringStatus !== "completed") nextRequiredStep = "final_wiring";
  else if (integrationBranchStatus !== "completed") nextRequiredStep = "integration_branch";
  else if (buildStatus !== "completed") nextRequiredStep = "build";
  else if (appPreviewTargetStatus !== "completed") nextRequiredStep = "app_preview_target";

  let disabledReason: string | null = null;
  if (!canRunIntegration) {
    if (failed > 0) {
      disabledReason =
        "실패한 CodeTask가 있어 통합을 시작할 수 없습니다.\n먼저 실패 작업을 다시 실행해 주세요.";
    } else if (selected > 0 && completed < selected) {
      disabledReason = `개발 CodeTask ${completed}/${selected} 완료\n미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.`;
    } else if (inconsistent > 0) {
      disabledReason = `개발 CodeTask ${completed}/${selected} 완료\n미완료 또는 검증 대기 중인 CodeTask가 있어 통합을 시작할 수 없습니다.`;
    } else if (!finalWiring && selected > 0) {
      disabledReason = "통합 단계를 준비하지 못했습니다.\n잠시 후 다시 시도해 주세요.";
    } else if (codetasksDone && finalWiring) {
      disabledReason = null;
    }
  } else if (codetasksDone) {
    disabledReason = `개발 CodeTask ${completed}/${selected} 완료\n최종 연결/통합 Wiring을 실행할 수 있습니다.`;
  }

  let readinessStatus: ImplementationRuntimeSnapshotV1["preview"]["readinessStatus"] =
    "codetask_completion_pending";
  if (integratedAppPreviewReady) readinessStatus = "integrated_app_preview_ready";
  else if (codetasksDone && finalWiringStatus !== "completed") readinessStatus = "final_wiring_pending";
  else if (codetasksDone && integrationBranchStatus !== "completed")
    readinessStatus = "integration_branch_pending";
  else if (codetasksDone && buildStatus !== "completed") readinessStatus = "build_pending";
  else if (codetasksDone && appPreviewTargetStatus !== "completed")
    readinessStatus = "app_preview_target_pending";
  else if (codeTaskPreviewReady) readinessStatus = "code_task_preview_ready";

  const previewSlice = {
    codeTask: {
      total,
      selected,
      completed,
      running,
      verifying,
      failed,
      skipped,
      pending,
      inconsistent,
      currentUnitId: currentUnit?.unitId ?? null,
      currentCodeTaskId: currentUnit?.codeTaskId ?? null,
      selectedUnitIds: reconciledSelected,
      pendingCodeTaskIds,
      inconsistentCodeTaskIds,
    },
    integration: {
      finalWiringStatus,
      integrationBranchStatus,
      buildStatus,
      appPreviewTargetStatus,
    },
    preview: {
      integratedAppPreviewReady,
      codeTaskPreviewReady,
      message: "",
    },
  };

  const message = buildPreviewMessage(previewSlice);

  return {
    projectId: pid,
    codeTask: previewSlice.codeTask,
    units: snapshotUnits,
    integration: {
      steps: stepRows,
      finalWiringStatus,
      integrationBranchStatus,
      buildStatus,
      appPreviewTargetStatus,
      canRunIntegration,
      canOpenCodeTaskPreview: codeTaskPreviewReady,
      canOpenIntegratedAppPreview: integratedAppPreviewReady,
      disabledReason: canRunIntegration
        ? null
        : disabledReason,
      nextRequiredStep,
    },
    preview: {
      codeTaskPreviewReady,
      integratedAppPreviewReady,
      previewUrl,
      readinessStatus,
      message,
    },
    diagnostics: {
      source: "implementation_runtime_snapshot",
      usedExecutionUnitCount: units.length,
      usedRunCount: input.codeTaskRuns.length,
      usedIntegrationStepCount: integrationSteps.length,
      ignoredCodeTaskPlanCount: input.codeTaskPlanCount ?? null,
      ignoredBranchPlanIntegrationCount: input.branchPlanIntegrationCount ?? null,
      warnings,
    },
  };
}

export function formatImplementationRuntimeSnapshotSummaryLines(
  snapshot: ImplementationRuntimeSnapshotV1,
): readonly string[] {
  const { codeTask } = snapshot;
  const lines: string[] = [
    `전체 CodeTask: ${codeTask.total}개`,
    `선택 CodeTask: ${codeTask.selected}개`,
  ];
  if (codeTask.selected > 0) {
    lines.push(`개발 CodeTask ${codeTask.completed}/${codeTask.selected} 완료`);
    lines.push(`완료 CodeTask: ${codeTask.completed} / ${codeTask.selected}`);
    if (codeTask.failed > 0) {
      lines.push(`실패 CodeTask: ${codeTask.failed}개`);
      lines.push("상태: 실패 작업 재실행 필요");
    }
  }
  if (codeTask.currentCodeTaskId) {
    const current = snapshot.units.find((u) => u.codeTaskId === codeTask.currentCodeTaskId);
    lines.push(`현재 CodeTask: ${current?.title ?? codeTask.currentCodeTaskId}`);
  }
  if (codeTask.inconsistent > 0) {
    lines.push(
      `검증 불일치: ${codeTask.inconsistent}개 (ExecutionUnit 상태와 GitHub outcome이 일치하지 않음)`,
    );
  }
  return lines;
}

export function buildImplementationRuntimeSnapshotFromRequirementsState(input: {
  readonly projectId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly executionUnits: readonly ImplementationExecutionUnitV1[];
  readonly selectedExecutionUnitIds: readonly string[];
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
  readonly codeTaskPlanCount?: number | null;
  readonly branchPlanIntegrationCount?: number | null;
}): ImplementationRuntimeSnapshotV1 {
  const runs = coalesceCodeTaskExecutionRunsV1(input.requirementsState?.codeTaskExecutionRunsV1);
  const steps = resolveIntegrationStepsForRuntimeSnapshot({
    requirementsState: input.requirementsState,
    codeTaskPlan: parseImplementationCodeTaskPlanV1(
      input.requirementsState?.implementationCodeTaskPlanV1,
    ),
  });
  return buildImplementationRuntimeSnapshot({
    projectId: input.projectId,
    executionUnits: input.executionUnits,
    selectedExecutionUnitIds: input.selectedExecutionUnitIds,
    codeTaskRuns: runs,
    integrationSteps: steps,
    previewRuntime: input.previewRuntime,
    codeTaskPlanCount: input.codeTaskPlanCount,
    branchPlanIntegrationCount: input.branchPlanIntegrationCount,
  });
}

export function loadPersistedRuntimeSnapshotInputs(
  requirementsState: RequirementsStateJson | null | undefined,
): Readonly<{
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedExecutionUnitIds: readonly string[];
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly integrationSteps: readonly ImplementationIntegrationStepV1[];
}> {
  return {
    units: loadImplementationExecutionUnitsFromState(requirementsState),
    selectedExecutionUnitIds: loadPersistedSelectedExecutionUnitIds(requirementsState),
    runs: coalesceCodeTaskExecutionRunsV1(requirementsState?.codeTaskExecutionRunsV1),
    integrationSteps: resolveIntegrationStepsForRuntimeSnapshot({
      requirementsState,
      codeTaskPlan: parseImplementationCodeTaskPlanV1(
        requirementsState?.implementationCodeTaskPlanV1,
      ),
    }),
  };
}
