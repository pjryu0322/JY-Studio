import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { isExecutionUnitInFlight } from "@/lib/prototype/implementationExecutionUnit";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { isSampleDataCodeTaskRef } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type CodeTaskSelectionModeV1 = "integration" | "execution" | "rework";

export type CodeTaskSelectionEligibilityReasonV1 =
  | "selectable"
  | "already_completed"
  | "not_completed_for_integration"
  | "currently_running"
  | "blocked_by_dependency"
  | "missing_github_outcome"
  | "not_runnable"
  | "unknown";

export type CodeTaskSelectionEligibilityV1 = Readonly<{
  readonly selectable: boolean;
  readonly reason: CodeTaskSelectionEligibilityReasonV1;
  readonly userMessage: string | null;
}>;

export type CodeTaskSelectionContextV1 = Readonly<{
  readonly codeTask: ImplementationCodeTaskV1;
  readonly unit?: ImplementationExecutionUnitV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressLabel?: string | null;
  readonly statusLabel?: string | null;
}>;

const INTEGRATION_INCOMPLETE_MESSAGE =
  "통합에는 완료되고 GitHub outcome이 저장된 CodeTask만 선택할 수 있습니다.";

const EXECUTION_NOT_RUNNABLE_MESSAGE = "현재 실행할 수 없는 CodeTask입니다.";

const REWORK_NOT_ELIGIBLE_MESSAGE = "현재 재작업 대상이 아닌 CodeTask입니다.";

function progressIndicatesRunnable(progressLabel: string | null | undefined): boolean {
  const p = String(progressLabel ?? "").trim();
  return p.includes("실행 가능") || p === "Quick 실행 대기";
}

function statusIndicatesPending(statusLabel: string | null | undefined): boolean {
  const s = String(statusLabel ?? "").trim();
  return s === "대기" || s === "준비" || s === "대기열";
}

function resolveOutcome(input: CodeTaskSelectionContextV1) {
  if (!input.unit) {
    return {
      status: "pending" as const,
      hasPersistedGithubOutcome: false,
    };
  }
  return resolveAuthoritativeCodeTaskOutcome({
    unit: input.unit,
    runs: input.runs ?? [],
  });
}

function isSampleDataTask(input: CodeTaskSelectionContextV1): boolean {
  const branchGroup = parseCodeTaskBranchPlanV1(input.codeTask.branchPlan)?.branchGroup ?? "";
  return (
    branchGroup === "data" ||
    isSampleDataCodeTaskRef({
      codeTaskId: input.codeTask.codeTaskId,
      parentTaskId: input.codeTask.parentTaskId,
      title: input.codeTask.title,
      changeType: input.codeTask.changeType,
    })
  );
}

function runningBlocked(input: CodeTaskSelectionContextV1): CodeTaskSelectionEligibilityV1 | null {
  if (input.unit && isExecutionUnitInFlight(input.unit.status)) {
    return {
      selectable: false,
      reason: "currently_running",
      userMessage: "실행 중인 CodeTask는 선택할 수 없습니다.",
    };
  }
  const outcome = resolveOutcome(input);
  if (outcome.status === "running" || outcome.status === "verifying") {
    return {
      selectable: false,
      reason: "currently_running",
      userMessage: "실행 중인 CodeTask는 선택할 수 없습니다.",
    };
  }
  return null;
}

function canSelectForIntegration(input: CodeTaskSelectionContextV1): CodeTaskSelectionEligibilityV1 {
  const blocked = runningBlocked(input);
  if (blocked) return blocked;

  const outcome = resolveOutcome(input);
  if (outcome.status === "verified" || outcome.status === "skipped") {
    if (outcome.hasPersistedGithubOutcome || outcome.status === "skipped") {
      return { selectable: true, reason: "selectable", userMessage: null };
    }
    return {
      selectable: false,
      reason: "missing_github_outcome",
      userMessage: INTEGRATION_INCOMPLETE_MESSAGE,
    };
  }

  return {
    selectable: false,
    reason: "not_completed_for_integration",
    userMessage: INTEGRATION_INCOMPLETE_MESSAGE,
  };
}

function canSelectForExecution(input: CodeTaskSelectionContextV1): CodeTaskSelectionEligibilityV1 {
  const blocked = runningBlocked(input);
  if (blocked) return blocked;

  const outcome = resolveOutcome(input);
  if (input.unit?.status === "blocked") {
    return {
      selectable: false,
      reason: "blocked_by_dependency",
      userMessage: "의존 작업이 완료되지 않아 아직 실행할 수 없습니다.",
    };
  }

  if (outcome.status === "verified" || outcome.status === "skipped") {
    return {
      selectable: false,
      reason: "already_completed",
      userMessage: "이미 완료된 작업입니다. 통합 대상으로 선택할 수 있습니다.",
    };
  }

  if (
    outcome.status === "failed" ||
    outcome.status === "pending" ||
    progressIndicatesRunnable(input.progressLabel) ||
    statusIndicatesPending(input.statusLabel) ||
    input.unit?.status === "ready" ||
    input.unit?.status === "failed"
  ) {
    if (isSampleDataTask(input)) {
      console.info(
        JSON.stringify({
          action: "sample_data_codetask_selected_for_execution",
          codeTaskId: input.codeTask.codeTaskId,
        }),
      );
    }
    return { selectable: true, reason: "selectable", userMessage: null };
  }

  return {
    selectable: false,
    reason: "not_runnable",
    userMessage: EXECUTION_NOT_RUNNABLE_MESSAGE,
  };
}

function canSelectForRework(input: CodeTaskSelectionContextV1): CodeTaskSelectionEligibilityV1 {
  const blocked = runningBlocked(input);
  if (blocked) return blocked;

  const outcome = resolveOutcome(input);
  if (input.unit?.status === "blocked") {
    return {
      selectable: false,
      reason: "blocked_by_dependency",
      userMessage: "의존 작업이 완료되지 않아 아직 실행할 수 없습니다.",
    };
  }

  if (
    outcome.status === "failed" ||
    outcome.status === "pending" ||
    progressIndicatesRunnable(input.progressLabel) ||
    statusIndicatesPending(input.statusLabel) ||
    input.unit?.status === "ready" ||
    input.unit?.status === "failed"
  ) {
    return { selectable: true, reason: "selectable", userMessage: null };
  }

  if (outcome.status === "verified") {
    return {
      selectable: false,
      reason: "already_completed",
      userMessage: "이미 완료된 작업입니다. 통합 대상으로 선택할 수 있습니다.",
    };
  }

  return {
    selectable: false,
    reason: "not_runnable",
    userMessage: REWORK_NOT_ELIGIBLE_MESSAGE,
  };
}

export function getCodeTaskSelectionEligibility(input: {
  readonly context: CodeTaskSelectionContextV1;
  readonly mode: CodeTaskSelectionModeV1;
  readonly quiet?: boolean;
}): CodeTaskSelectionEligibilityV1 {
  const eligibility =
    input.mode === "integration"
      ? canSelectForIntegration(input.context)
      : input.mode === "rework"
        ? canSelectForRework(input.context)
        : canSelectForExecution(input.context);

  if (!input.quiet) {
    console.info(
      JSON.stringify({
        action: eligibility.selectable ? "codetask_selection_eligible" : "codetask_selection_blocked",
        codeTaskId: input.context.codeTask.codeTaskId,
        mode: input.mode,
        selectable: eligibility.selectable,
        reason: eligibility.reason,
        branchGroup: parseCodeTaskBranchPlanV1(input.context.codeTask.branchPlan)?.branchGroup ?? null,
      }),
    );
  }

  return eligibility;
}

export function evaluateIntegrationBoardSelectionGate(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): Readonly<{ readonly ok: boolean; readonly message: string | null }> {
  const validIds = new Set(input.codeTasks.map((t) => t.codeTaskId.trim()).filter(Boolean));
  const selected = [...new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean))].filter(
    (id) => validIds.has(id),
  );
  if (!selected.length) {
    return { ok: false, message: "선택된 작업이 없습니다." };
  }
  const integrationIds = new Set(
    filterCodeTaskIdsForSelectionMode({
      codeTaskIds: selected,
      mode: "integration",
      codeTasks: input.codeTasks,
      units: input.units,
      runs: input.runs,
    }),
  );
  const hasNonIntegrationSelection = selected.some((id) => !integrationIds.has(id));
  if (hasNonIntegrationSelection) {
    return { ok: false, message: INTEGRATION_SELECTION_INCOMPLETE_USER_MESSAGE };
  }
  return { ok: true, message: null };
}

export const DEFAULT_CODE_TASK_TREE_SELECTION_MODE: CodeTaskSelectionModeV1 = "execution";

export function resolveCodeTaskSelectionModeForUiContext(input: {
  readonly surface?: "task_tree" | "integration_section" | null;
}): CodeTaskSelectionModeV1 {
  if (input.surface === "integration_section") return "integration";
  return DEFAULT_CODE_TASK_TREE_SELECTION_MODE;
}

export function logCodeTaskSelectionModeResolved(input: {
  readonly projectId?: string | null;
  readonly mode: CodeTaskSelectionModeV1;
  readonly selectableCount: number;
}): void {
  console.info(
    JSON.stringify({
      action: "codetask_selection_mode_resolved",
      projectId: input.projectId ?? null,
      mode: input.mode,
      selectableCount: input.selectableCount,
    }),
  );
}

export function filterCodeTaskIdsForSelectionMode(input: {
  readonly codeTaskIds: readonly string[];
  readonly mode: CodeTaskSelectionModeV1;
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
}): readonly string[] {
  const taskById = new Map(input.codeTasks.map((t) => [t.codeTaskId.trim(), t] as const));
  const unitByCodeTaskId = new Map((input.units ?? []).map((u) => [u.codeTaskId, u] as const));
  const out: string[] = [];
  for (const raw of input.codeTaskIds) {
    const id = raw.trim();
    if (!id) continue;
    const codeTask = taskById.get(id);
    if (!codeTask) continue;
    const labels = input.progressByCodeTaskId?.get(id);
    const eligibility = getCodeTaskSelectionEligibility({
      mode: input.mode,
      quiet: true,
      context: {
        codeTask,
        unit: unitByCodeTaskId.get(id) ?? null,
        runs: input.runs,
        statusLabel: labels?.statusLabel,
        progressLabel: labels?.progressLabel,
      },
    });
    if (eligibility.selectable) out.push(id);
  }
  return out;
}

export function listSelectableCodeTaskIdsForMode(input: {
  readonly mode: CodeTaskSelectionModeV1;
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
}): readonly string[] {
  return filterCodeTaskIdsForSelectionMode({
    codeTaskIds: input.codeTasks.map((t) => t.codeTaskId),
    mode: input.mode,
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
    progressByCodeTaskId: input.progressByCodeTaskId,
  });
}

export function evaluateExecutionSelectionGate(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly mode?: CodeTaskSelectionModeV1;
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): Readonly<{ readonly ok: boolean; readonly message: string | null; readonly runnableIds: readonly string[] }> {
  const mode = input.mode ?? "execution";
  const runnableIds = filterCodeTaskIdsForSelectionMode({
    codeTaskIds: input.selectedCodeTaskIds,
    mode,
    codeTasks: input.codeTasks,
    units: input.units,
    runs: input.runs,
  });
  if (!input.selectedCodeTaskIds.length) {
    return { ok: false, message: "실행할 CodeTask를 선택해 주세요.", runnableIds: [] };
  }
  if (!runnableIds.length) {
    return {
      ok: false,
      message: "선택한 CodeTask 중 현재 실행할 수 있는 작업이 없습니다.",
      runnableIds: [],
    };
  }
  return { ok: true, message: null, runnableIds };
}

export const INTEGRATION_SELECTION_INCOMPLETE_USER_MESSAGE =
  "통합에는 완료된 CodeTask만 사용할 수 있습니다.\n미완료 작업은 먼저 실행하거나 재작업해 주세요." as const;
