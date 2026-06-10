import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { isExecutionUnitInFlight } from "@/lib/prototype/implementationExecutionUnit";
import {
  formatExecutionUnitVerificationCardLabels,
  resolveExecutionUnitVerificationDisplayStatus,
} from "@/lib/prototype/implementationExecutionUnitVerification";
import { isSampleDataCodeTaskRef } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type RunnableCodeTaskSelectionContextV1 = Readonly<{
  readonly codeTask: ImplementationCodeTaskV1;
  readonly unit?: ImplementationExecutionUnitV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly statusLabel?: string | null;
  readonly progressLabel?: string | null;
}>;

export type RunnableCodeTaskSelectionReasonV1 =
  | "selectable"
  | "already_completed"
  | "currently_running"
  | "blocked_by_dependency"
  | "not_runnable";

export type RunnableCodeTaskSelectionStateV1 = Readonly<{
  readonly selectable: boolean;
  readonly reason: RunnableCodeTaskSelectionReasonV1;
  readonly userMessage: string | null;
}>;

const COMPLETED_USER_MESSAGE =
  "이미 완료된 작업입니다. 통합 시 자동 포함됩니다." as const;

export function resolveCodeTaskDisplayLabelsForUserSelection(input: {
  readonly codeTaskId: string;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
  readonly unit?: ImplementationExecutionUnitV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): Readonly<{ readonly statusLabel: string; readonly progressLabel: string }> {
  const fromMap = input.progressByCodeTaskId?.get(input.codeTaskId.trim());
  if (fromMap?.statusLabel && fromMap?.progressLabel) {
    return { statusLabel: fromMap.statusLabel, progressLabel: fromMap.progressLabel };
  }
  if (input.unit) {
    const run = findLatestRunForCodeTask(input.runs ?? [], input.codeTaskId);
    const display = resolveExecutionUnitVerificationDisplayStatus({ unit: input.unit, run });
    const card = formatExecutionUnitVerificationCardLabels(display);
    return { statusLabel: card.statusLabel, progressLabel: card.progressLabel };
  }
  return { statusLabel: "", progressLabel: "" };
}

function isSampleDataCodeTask(ctx: RunnableCodeTaskSelectionContextV1): boolean {
  const branchGroup = parseCodeTaskBranchPlanV1(ctx.codeTask.branchPlan)?.branchGroup ?? "";
  return (
    branchGroup === "data" ||
    /^CODE-DATA-SAMPLE/i.test(ctx.codeTask.codeTaskId.trim()) ||
    isSampleDataCodeTaskRef({
      codeTaskId: ctx.codeTask.codeTaskId,
      parentTaskId: ctx.codeTask.parentTaskId,
      title: ctx.codeTask.title,
      changeType: ctx.codeTask.changeType,
    })
  );
}

function labelsIndicateCompleted(statusLabel: string, progressLabel: string): boolean {
  const s = statusLabel.trim();
  const p = progressLabel.trim();
  return (
    s === "완료" ||
    p.includes("GitHub outcome") ||
    p.includes("outcome 저장") ||
    p === "완료"
  );
}

function labelsIndicateRunning(statusLabel: string, progressLabel: string): boolean {
  const s = statusLabel.trim();
  const p = progressLabel.trim();
  return s === "실행 중" || p.includes("실행 중") || p.includes("검증 중");
}

function labelsIndicateRunnable(statusLabel: string, progressLabel: string): boolean {
  const s = statusLabel.trim();
  const p = progressLabel.trim();
  return (
    p.includes("실행 가능") ||
    p === "Quick 실행 대기" ||
    s === "대기" ||
    s === "준비" ||
    s === "대기열" ||
    s === "실패"
  );
}

export function isIntegrationReadyCodeTask(input: RunnableCodeTaskSelectionContextV1): boolean {
  if (!input.unit) return false;
  const outcome = resolveAuthoritativeCodeTaskOutcome({
    unit: input.unit,
    runs: input.runs ?? [],
  });
  return (
    (outcome.status === "verified" || outcome.status === "skipped") &&
    (outcome.hasPersistedGithubOutcome || outcome.status === "skipped")
  );
}

export function isUserSelectableRunnableCodeTask(input: RunnableCodeTaskSelectionContextV1): boolean {
  return resolveUserRunnableCodeTaskSelectionState(input).selectable;
}

export function resolveUserRunnableCodeTaskSelectionState(
  input: RunnableCodeTaskSelectionContextV1,
): RunnableCodeTaskSelectionStateV1 {
  const statusLabel = String(input.statusLabel ?? "").trim();
  const progressLabel = String(input.progressLabel ?? "").trim();

  if (labelsIndicateCompleted(statusLabel, progressLabel)) {
    return {
      selectable: false,
      reason: "already_completed",
      userMessage: COMPLETED_USER_MESSAGE,
    };
  }

  if (input.unit && isExecutionUnitInFlight(input.unit.status)) {
    return {
      selectable: false,
      reason: "currently_running",
      userMessage: "현재 실행 중인 작업은 선택할 수 없습니다.",
    };
  }

  if (labelsIndicateRunning(statusLabel, progressLabel)) {
    return {
      selectable: false,
      reason: "currently_running",
      userMessage: "현재 실행 중인 작업은 선택할 수 없습니다.",
    };
  }

  const outcome = input.unit
    ? resolveAuthoritativeCodeTaskOutcome({ unit: input.unit, runs: input.runs ?? [] })
    : null;
  if (outcome?.status === "running" || outcome?.status === "verifying") {
    return {
      selectable: false,
      reason: "currently_running",
      userMessage: "현재 실행 중인 작업은 선택할 수 없습니다.",
    };
  }

  if (outcome?.status === "verified" || outcome?.status === "skipped") {
    return {
      selectable: false,
      reason: "already_completed",
      userMessage: COMPLETED_USER_MESSAGE,
    };
  }

  const blocked = input.unit?.status === "blocked" || statusLabel.includes("차단");
  const runnableByLabels = labelsIndicateRunnable(statusLabel, progressLabel);
  const runnableByUnit =
    input.unit?.status === "ready" ||
    input.unit?.status === "queued" ||
    input.unit?.status === "failed";

  if (isSampleDataCodeTask(input) && (runnableByLabels || runnableByUnit || input.unit?.status === "ready")) {
    console.info(
      JSON.stringify({
        action: "runnable_codetask_selected",
        codeTaskId: input.codeTask.codeTaskId,
        statusLabel: statusLabel || null,
        progressLabel: progressLabel || null,
      }),
    );
    return { selectable: true, reason: "selectable", userMessage: null };
  }

  if (blocked && !isSampleDataCodeTask(input)) {
    return {
      selectable: false,
      reason: "blocked_by_dependency",
      userMessage: "의존 작업이 완료되지 않아 아직 실행할 수 없습니다.",
    };
  }

  if (runnableByLabels || runnableByUnit || outcome?.status === "failed" || outcome?.status === "pending") {
    return { selectable: true, reason: "selectable", userMessage: null };
  }

  return {
    selectable: false,
    reason: "not_runnable",
    userMessage: "현재 실행할 수 없는 CodeTask입니다.",
  };
}

export function listUserSelectableRunnableCodeTaskIds(input: {
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
  readonly visibleCodeTaskIds?: readonly string[] | null;
}): readonly string[] {
  const visibleSet = new Set(
    (input.visibleCodeTaskIds ?? input.codeTasks.map((t) => t.codeTaskId)).map((id) => id.trim()).filter(Boolean),
  );
  const unitById = new Map((input.units ?? []).map((u) => [u.codeTaskId, u] as const));
  const out: string[] = [];
  for (const codeTask of input.codeTasks) {
    const id = codeTask.codeTaskId.trim();
    if (!id || !visibleSet.has(id)) continue;
    const labels = resolveCodeTaskDisplayLabelsForUserSelection({
      codeTaskId: id,
      progressByCodeTaskId: input.progressByCodeTaskId,
      unit: unitById.get(id) ?? null,
      runs: input.runs,
    });
    const selectable = isUserSelectableRunnableCodeTask({
      codeTask,
      unit: unitById.get(id) ?? null,
      runs: input.runs,
      statusLabel: labels.statusLabel,
      progressLabel: labels.progressLabel,
    });
    if (selectable) out.push(id);
  }
  return out;
}

export function listIntegrationReadyCodeTaskIds(input: {
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly visibleCodeTaskIds?: readonly string[] | null;
}): readonly string[] {
  const visibleSet = new Set(
    (input.visibleCodeTaskIds ?? input.codeTasks.map((t) => t.codeTaskId)).map((id) => id.trim()).filter(Boolean),
  );
  const unitById = new Map((input.units ?? []).map((u) => [u.codeTaskId, u] as const));
  const out: string[] = [];
  for (const codeTask of input.codeTasks) {
    const id = codeTask.codeTaskId.trim();
    if (!id || !visibleSet.has(id)) continue;
    if (
      isIntegrationReadyCodeTask({
        codeTask,
        unit: unitById.get(id) ?? null,
        runs: input.runs,
      })
    ) {
      out.push(id);
    }
  }
  if (out.length) {
    console.info(
      JSON.stringify({
        action: "integration_ready_codetasks_auto_collected",
        integrationReadyCount: out.length,
      }),
    );
  }
  return out;
}

export function filterSelectedRunnableCodeTaskIds(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
}): readonly string[] {
  const runnable = new Set(
    listUserSelectableRunnableCodeTaskIds({
      codeTasks: input.codeTasks,
      units: input.units,
      runs: input.runs,
      progressByCodeTaskId: input.progressByCodeTaskId,
    }),
  );
  return [...new Set(input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean))].filter((id) =>
    runnable.has(id),
  );
}

export function evaluateSelectedRunnableCodeTasksGate(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
}): Readonly<{ readonly ok: boolean; readonly message: string | null; readonly runnableIds: readonly string[] }> {
  const runnableIds = filterSelectedRunnableCodeTaskIds(input);
  if (!input.selectedCodeTaskIds.length) {
    return { ok: false, message: "실행할 CodeTask를 선택해 주세요.", runnableIds: [] };
  }
  if (!runnableIds.length) {
    console.info(JSON.stringify({ action: "execute_selected_runnable_codetasks_rejected_empty" }));
    return {
      ok: false,
      message: "실행 가능한 선택 작업이 없습니다.",
      runnableIds: [],
    };
  }
  console.info(
    JSON.stringify({
      action: "execute_selected_runnable_codetasks_requested",
      runnableCount: runnableIds.length,
    }),
  );
  return { ok: true, message: null, runnableIds };
}

export const INTEGRATION_BLOCKED_BY_RUNNABLE_USER_MESSAGE =
  "실행 가능한 미완료 작업이 있습니다. 먼저 선택 작업 실행을 완료해 주세요." as const;
