import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

export type ResolveCanonicalCodeTaskResultV1 =
  | Readonly<{ readonly status: "matched"; readonly codeTask: ImplementationCodeTaskV1 }>
  | Readonly<{
      readonly status: "repaired";
      readonly fromCodeTaskId: string;
      readonly toCodeTaskId: string;
      readonly codeTask: ImplementationCodeTaskV1;
      readonly reason: string;
    }>
  | Readonly<{ readonly status: "blocked_mock_id"; readonly codeTaskId: string; readonly reason: string }>
  | Readonly<{ readonly status: "not_found"; readonly codeTaskId: string }>;

const LEGACY_MOCK_CODE_TASK_ID_PREFIX = "CODE-DEV-MOCK-";

/** Production SoT — 샘플 데이터 CodeTask id (plan·run·UI·API 공통). */
export const CANONICAL_SAMPLE_DATA_CODE_TASK_ID = "CODE-DATA-SAMPLE-001";

/** @deprecated plan/run 정렬 시 {@link CANONICAL_SAMPLE_DATA_CODE_TASK_ID} 로 통합 */
export const LEGACY_SAMPLE_DATA_CODE_TASK_ID = "CODE-DEV-SAMPLE-DATA-001-001" as const;

const LEGACY_CANONICAL_SAMPLE_DATA_CODE_TASK_ID = LEGACY_SAMPLE_DATA_CODE_TASK_ID;

export function isLegacyMockCodeTaskId(codeTaskId: string): boolean {
  return String(codeTaskId ?? "")
    .trim()
    .toUpperCase()
    .startsWith(LEGACY_MOCK_CODE_TASK_ID_PREFIX);
}

export function isMockCodeTaskId(codeTaskId: string): boolean {
  return isLegacyMockCodeTaskId(codeTaskId);
}

export function buildSemanticProductionCodeTaskId(input: {
  readonly parentTaskId: string;
  readonly sequence: number;
  readonly taskType?: string | null;
  readonly title?: string | null;
}): string {
  const seq = String(input.sequence).padStart(3, "0");
  const parent = input.parentTaskId.trim();
  const taskType = String(input.taskType ?? "").trim().toLowerCase();
  if (taskType === "mock" || taskType === "data" || /DEV-MOCK|SAMPLE.?DATA/i.test(parent)) {
    if (/SAMPLE-DATA/i.test(parent)) {
      return `CODE-${parent}-${seq}`;
    }
    return `CODE-DATA-SAMPLE-${seq}`;
  }
  if (taskType === "frame" || /DEV-FRAME/i.test(parent)) {
    return `CODE-DEV-FRAME-001-${seq}`;
  }
  return `CODE-${parent}-${seq}`;
}

export type RepairMockCodeTaskIdResultV1 =
  | Readonly<{ readonly status: "not_mock"; readonly codeTaskId: string }>
  | Readonly<{
      readonly status: "repaired";
      readonly fromCodeTaskId: string;
      readonly toCodeTaskId: string;
      readonly reason: string;
    }>
  | Readonly<{
      readonly status: "blocked";
      readonly codeTaskId: string;
      readonly reason: "mock_id_not_repairable" | "canonical_id_conflict" | "ambiguous_data_task";
    }>;

function isSampleDataRoleTitle(title: string): boolean {
  return /샘플|sample|mock\s*data|fixture|더미/i.test(title);
}

export function repairMockCodeTaskIdIfPossible(input: {
  readonly codeTaskId: string;
  readonly title?: string | null;
  readonly role?: string | null;
  readonly branchGroup?: string | null;
  readonly workBranch?: string | null;
  readonly existingCodeTaskIds: readonly string[];
}): RepairMockCodeTaskIdResultV1 {
  const fromId = String(input.codeTaskId ?? "").trim();
  if (!isLegacyMockCodeTaskId(fromId)) {
    return { status: "not_mock", codeTaskId: fromId };
  }
  const targetId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
  const others = input.existingCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  if (others.some((id) => id === targetId && id !== fromId)) {
    return { status: "blocked", codeTaskId: fromId, reason: "canonical_id_conflict" };
  }
  const bg = String(input.branchGroup ?? "").trim();
  const workBranch = String(input.workBranch ?? "").trim();
  const titleHint = `${input.title ?? ""} ${input.role ?? ""}`.trim();
  const dataLike =
    bg === "data" ||
    /sample-data/i.test(workBranch) ||
    isSampleDataRoleTitle(titleHint);
  if (!dataLike) {
    return { status: "blocked", codeTaskId: fromId, reason: "mock_id_not_repairable" };
  }
  return {
    status: "repaired",
    fromCodeTaskId: fromId,
    toCodeTaskId: targetId,
    reason: "data_sample_task_canonicalized",
  };
}

function remapDependencyIds(
  deps: readonly string[] | undefined,
  idMap: ReadonlyMap<string, string>,
): readonly string[] {
  return (deps ?? []).map((id) => idMap.get(id.trim()) ?? id.trim()).filter(Boolean);
}

export function repairLegacyMockCodeTaskIdsInPlan(
  tasks: readonly ImplementationCodeTaskV1[],
): readonly ImplementationCodeTaskV1[] {
  const idMap = new Map<string, string>();
  for (const task of tasks) {
    const repair = repairMockCodeTaskIdIfPossible({
      codeTaskId: task.codeTaskId,
      title: task.title,
      branchGroup: parseCodeTaskBranchPlanV1(task.branchPlan)?.branchGroup ?? null,
      workBranch: parseCodeTaskBranchPlanV1(task.branchPlan)?.workBranch ?? null,
      existingCodeTaskIds: tasks.map((t) => t.codeTaskId),
    });
    if (repair.status === "repaired") {
      idMap.set(repair.fromCodeTaskId, repair.toCodeTaskId);
    }
  }
  for (const task of tasks) {
    const id = task.codeTaskId.trim();
    if (id === LEGACY_CANONICAL_SAMPLE_DATA_CODE_TASK_ID) {
      idMap.set(id, CANONICAL_SAMPLE_DATA_CODE_TASK_ID);
    }
  }
  if (!idMap.size) return tasks;
  return tasks.map((task) => {
    const nextId = idMap.get(task.codeTaskId.trim()) ?? task.codeTaskId;
    return {
      ...task,
      codeTaskId: nextId,
      codeTaskDependencies: remapDependencyIds(task.codeTaskDependencies, idMap),
      dependencies: remapDependencyIds(task.dependencies, idMap),
    };
  });
}

function listDataBranchCodeTasks(codeTasks: readonly ImplementationCodeTaskV1[]): readonly ImplementationCodeTaskV1[] {
  return codeTasks.filter((t) => parseCodeTaskBranchPlanV1(t.branchPlan)?.branchGroup === "data");
}

export function resolveCanonicalCodeTaskForQueuedRun(input: {
  readonly queuedCodeTaskId: string;
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly currentCodeTaskTitle?: string | null;
  readonly branchGroup?: string | null;
  readonly workBranch?: string | null;
}): ResolveCanonicalCodeTaskResultV1 {
  const queuedId = String(input.queuedCodeTaskId ?? "").trim();
  if (!queuedId) {
    return { status: "not_found", codeTaskId: queuedId };
  }

  const direct = input.codeTasks.find((t) => t.codeTaskId.trim() === queuedId);
  if (direct) {
    return { status: "matched", codeTask: direct };
  }

  if (!isLegacyMockCodeTaskId(queuedId)) {
    return { status: "not_found", codeTaskId: queuedId };
  }

  const repair = repairMockCodeTaskIdIfPossible({
    codeTaskId: queuedId,
    title: input.currentCodeTaskTitle,
    branchGroup: input.branchGroup,
    workBranch: input.workBranch,
    existingCodeTaskIds: input.codeTasks.map((t) => t.codeTaskId),
  });
  if (repair.status === "repaired") {
    const codeTask = input.codeTasks.find((t) => t.codeTaskId.trim() === repair.toCodeTaskId);
    if (codeTask) {
      return {
        status: "repaired",
        fromCodeTaskId: repair.fromCodeTaskId,
        toCodeTaskId: repair.toCodeTaskId,
        codeTask,
        reason: repair.reason,
      };
    }
  }

  const dataTasks = listDataBranchCodeTasks(input.codeTasks);
  if (dataTasks.length !== 1) {
    return {
      status: "blocked_mock_id",
      codeTaskId: queuedId,
      reason: dataTasks.length === 0 ? "queued_code_task_id_not_in_current_plan" : "data_branch_not_singleton",
    };
  }

  const canonical = dataTasks[0]!;
  return {
    status: "repaired",
    fromCodeTaskId: queuedId,
    toCodeTaskId: canonical.codeTaskId,
    codeTask: canonical,
    reason: "data_branch_singleton_match",
  };
}

export function planContainsLegacyMockCodeTaskId(tasks: readonly ImplementationCodeTaskV1[]): boolean {
  return tasks.some((t) => isLegacyMockCodeTaskId(t.codeTaskId));
}

export function isLegacySampleDataCodeTaskId(codeTaskId: string): boolean {
  const id = String(codeTaskId ?? "").trim();
  if (!id) return false;
  if (id === LEGACY_SAMPLE_DATA_CODE_TASK_ID) return true;
  if (/^CODE-DEV-SAMPLE-DATA-/i.test(id)) return true;
  if (/^CODE-DATA-SAMPLE-/i.test(id) && id !== CANONICAL_SAMPLE_DATA_CODE_TASK_ID) return true;
  return isLegacyMockCodeTaskId(id) && /sample/i.test(id);
}

export function resolveCanonicalSampleDataCodeTaskId(input: {
  readonly codeTaskId: string;
  readonly codeTasks?: readonly ImplementationCodeTaskV1[];
}): string {
  const id = String(input.codeTaskId ?? "").trim();
  if (!id) return CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
  if (id === CANONICAL_SAMPLE_DATA_CODE_TASK_ID) return id;

  const tasks = input.codeTasks ?? [];
  const direct = tasks.find((t) => t.codeTaskId.trim() === id);
  if (direct) return direct.codeTaskId.trim();

  const dataTask =
    tasks.find((t) => t.codeTaskId.trim() === CANONICAL_SAMPLE_DATA_CODE_TASK_ID) ??
    tasks.find((t) => parseCodeTaskBranchPlanV1(t.branchPlan)?.branchGroup === "data") ??
    null;
  if (dataTask && isLegacySampleDataCodeTaskId(id)) {
    return dataTask.codeTaskId.trim();
  }
  if (isLegacySampleDataCodeTaskId(id)) {
    return CANONICAL_SAMPLE_DATA_CODE_TASK_ID;
  }
  return id;
}

export function augmentProductionCodeTaskIdRemap(input: {
  readonly remap: Map<string, string>;
  readonly repairedTasks: readonly ImplementationCodeTaskV1[];
  readonly runCodeTaskIds?: readonly string[];
}): void {
  const canonical =
    input.repairedTasks.find((t) => t.codeTaskId.trim() === CANONICAL_SAMPLE_DATA_CODE_TASK_ID) ??
    input.repairedTasks.find(
      (t) => parseCodeTaskBranchPlanV1(t.branchPlan)?.branchGroup === "data",
    ) ??
    null;
  if (!canonical) return;
  const toId = canonical.codeTaskId.trim();
  for (const fromId of [
    LEGACY_SAMPLE_DATA_CODE_TASK_ID,
    ...(input.runCodeTaskIds ?? []),
  ]) {
    const from = fromId.trim();
    if (!from || from === toId) continue;
    if (isLegacySampleDataCodeTaskId(from)) {
      input.remap.set(from, toId);
    }
  }
}

export function remapCodeTaskExecutionRunsV1(
  runs: readonly CodeTaskExecutionRunV1[],
  idRemap: ReadonlyMap<string, string>,
): readonly CodeTaskExecutionRunV1[] {
  if (!idRemap.size) return runs;
  let changed = false;
  const remapped = runs.map((run) => {
    const nextId = idRemap.get(run.codeTaskId.trim());
    if (!nextId || nextId === run.codeTaskId.trim()) return run;
    changed = true;
    return { ...run, codeTaskId: nextId };
  });
  return changed ? remapped : runs;
}

export function remapSelectedCodeTaskIdFromMockToPlan(input: {
  readonly codeTaskId: string;
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
}): string | null {
  const id = input.codeTaskId.trim();
  if (!id) return null;
  if (input.codeTasks.some((t) => t.codeTaskId.trim() === id)) return id;
  if (isLegacySampleDataCodeTaskId(id)) {
    return resolveCanonicalSampleDataCodeTaskId({ codeTaskId: id, codeTasks: input.codeTasks });
  }
  if (!isLegacyMockCodeTaskId(id)) return null;
  const resolved = resolveCanonicalCodeTaskForQueuedRun({
    queuedCodeTaskId: id,
    codeTasks: input.codeTasks,
    branchGroup: "data",
  });
  if (resolved.status === "repaired") return resolved.toCodeTaskId;
  if (resolved.status === "matched") return resolved.codeTask.codeTaskId;
  return null;
}
