import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  findLatestRunForCodeTask,
  type CodeTaskExecutionRunStatus,
  type CodeTaskExecutionRunV1,
} from "@/lib/prototype/codeTaskExecutionRun";

export type CodeTaskDependencyCheckStatus =
  | "ready"
  | "blocked"
  | "unknown_dependency"
  | "not_selected";

export type CodeTaskDependencyCheckResult = Readonly<{
  codeTaskId: string;
  status: CodeTaskDependencyCheckStatus;
  missingCodeTaskIds: readonly string[];
  incompleteCodeTaskIds: readonly string[];
  unknownDependencyIds: readonly string[];
  message?: string;
}>;

export function isCodeTaskDependencySatisfiedRunStatus(
  status: CodeTaskExecutionRunStatus,
): boolean {
  return status === "completed" || status === "no_code_change_completed";
}

export function resolveEffectiveCodeTaskDependencies(
  codeTask: ImplementationCodeTaskV1,
): readonly string[] {
  const parent = (codeTask.parentTaskDependencies ?? []).map((id) => id.trim()).filter(Boolean);
  const codeDeps = (codeTask.codeTaskDependencies ?? []).map((id) => id.trim()).filter(Boolean);
  if (parent.length || codeDeps.length) {
    return [...new Set([...parent, ...codeDeps])];
  }
  return (codeTask.dependencies ?? []).map((id) => id.trim()).filter(Boolean);
}

type CodeTaskPlanIndex = Readonly<{
  readonly codeTaskById: ReadonlyMap<string, ImplementationCodeTaskV1>;
  readonly codeTaskIdsByParentTaskId: ReadonlyMap<string, readonly string[]>;
  readonly parentTaskIds: ReadonlySet<string>;
}>;

function buildCodeTaskPlanIndex(plan: ImplementationCodeTaskPlanV1): CodeTaskPlanIndex {
  const codeTaskById = new Map<string, ImplementationCodeTaskV1>();
  const codeTaskIdsByParentTaskId = new Map<string, string[]>();
  const parentTaskIds = new Set<string>();
  for (const task of plan.tasks) {
    codeTaskById.set(task.codeTaskId, task);
    const parentId = task.parentTaskId.trim();
    if (parentId) {
      parentTaskIds.add(parentId);
      const list = codeTaskIdsByParentTaskId.get(parentId) ?? [];
      list.push(task.codeTaskId);
      codeTaskIdsByParentTaskId.set(parentId, list);
    }
  }
  return { codeTaskById, codeTaskIdsByParentTaskId, parentTaskIds };
}

function isCodeTaskRunSatisfied(
  runs: readonly CodeTaskExecutionRunV1[],
  codeTaskId: string,
): boolean {
  const run = findLatestRunForCodeTask(runs, codeTaskId);
  return Boolean(run && isCodeTaskDependencySatisfiedRunStatus(run.status));
}

function checkParentTaskDependencySatisfied(input: {
  readonly parentTaskId: string;
  readonly index: CodeTaskPlanIndex;
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): readonly string[] {
  const childIds = input.index.codeTaskIdsByParentTaskId.get(input.parentTaskId) ?? [];
  if (!childIds.length) return [input.parentTaskId];
  const incomplete = childIds.filter((id) => !isCodeTaskRunSatisfied(input.runs, id));
  return incomplete;
}

function evaluateDependencyId(input: {
  readonly dependencyId: string;
  readonly index: CodeTaskPlanIndex;
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): Readonly<{
  readonly unknown: boolean;
  readonly incompleteCodeTaskIds: readonly string[];
}> {
  const depId = input.dependencyId.trim();
  if (!depId) return { unknown: false, incompleteCodeTaskIds: [] };

  if (input.index.codeTaskById.has(depId)) {
    return isCodeTaskRunSatisfied(input.runs, depId)
      ? { unknown: false, incompleteCodeTaskIds: [] }
      : { unknown: false, incompleteCodeTaskIds: [depId] };
  }

  if (input.index.parentTaskIds.has(depId)) {
    const incomplete = checkParentTaskDependencySatisfied({
      parentTaskId: depId,
      index: input.index,
      runs: input.runs,
    });
    return incomplete.length
      ? { unknown: false, incompleteCodeTaskIds: incomplete }
      : { unknown: false, incompleteCodeTaskIds: [] };
  }

  return { unknown: true, incompleteCodeTaskIds: [] };
}

export function checkCodeTaskDependencyReady(input: {
  readonly codeTaskId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): CodeTaskDependencyCheckResult {
  const codeTaskId = input.codeTaskId.trim();
  const codeTask = input.codeTaskPlan.tasks.find((t) => t.codeTaskId === codeTaskId);
  if (!codeTask) {
    return {
      codeTaskId,
      status: "unknown_dependency",
      missingCodeTaskIds: [],
      incompleteCodeTaskIds: [],
      unknownDependencyIds: [codeTaskId],
      message: `CodeTask ${codeTaskId}를 찾을 수 없습니다.`,
    };
  }

  const dependencies = resolveEffectiveCodeTaskDependencies(codeTask);
  if (!dependencies.length) {
    return {
      codeTaskId,
      status: "ready",
      missingCodeTaskIds: [],
      incompleteCodeTaskIds: [],
      unknownDependencyIds: [],
    };
  }

  const index = buildCodeTaskPlanIndex(input.codeTaskPlan);
  const incompleteCodeTaskIds = new Set<string>();
  const unknownDependencyIds = new Set<string>();

  for (const depId of dependencies) {
    const result = evaluateDependencyId({
      dependencyId: depId,
      index,
      runs: input.runs,
    });
    if (result.unknown) {
      unknownDependencyIds.add(depId);
      continue;
    }
    for (const incompleteId of result.incompleteCodeTaskIds) {
      incompleteCodeTaskIds.add(incompleteId);
    }
  }

  if (unknownDependencyIds.size) {
    return {
      codeTaskId,
      status: "unknown_dependency",
      missingCodeTaskIds: [],
      incompleteCodeTaskIds: [...incompleteCodeTaskIds],
      unknownDependencyIds: [...unknownDependencyIds],
      message: `알 수 없는 dependency: ${[...unknownDependencyIds].join(", ")}`,
    };
  }

  if (incompleteCodeTaskIds.size) {
    const blockerId = [...incompleteCodeTaskIds][0] ?? "";
    const blockerTitle = blockerId
      ? input.codeTaskPlan.tasks.find((t) => t.codeTaskId === blockerId)?.title ??
        input.codeTaskPlan.tasks.find((t) => t.parentTaskId === blockerId)?.title ??
        blockerId
      : "";
    return {
      codeTaskId,
      status: "blocked",
      missingCodeTaskIds: [...incompleteCodeTaskIds],
      incompleteCodeTaskIds: [...incompleteCodeTaskIds],
      unknownDependencyIds: [],
      message: blockerId
        ? `선행 작업 필요: ${blockerTitle}`
        : "선행 CodeTask가 완료되지 않았습니다.",
    };
  }

  return {
    codeTaskId,
    status: "ready",
    missingCodeTaskIds: [],
    incompleteCodeTaskIds: [],
    unknownDependencyIds: [],
  };
}

export type CodeTaskDependencyQueuePartition = Readonly<{
  readonly readyIds: readonly string[];
  readonly blocked: readonly CodeTaskDependencyCheckResult[];
  readonly unknown: readonly CodeTaskDependencyCheckResult[];
}>;

export function partitionCodeTaskIdsByDependencyReadiness(input: {
  readonly codeTaskIds: readonly string[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): CodeTaskDependencyQueuePartition {
  const readyIds: string[] = [];
  const blocked: CodeTaskDependencyCheckResult[] = [];
  const unknown: CodeTaskDependencyCheckResult[] = [];
  for (const codeTaskId of input.codeTaskIds) {
    const check = checkCodeTaskDependencyReady({
      codeTaskId,
      codeTaskPlan: input.codeTaskPlan,
      runs: input.runs,
    });
    if (check.status === "ready") {
      readyIds.push(codeTaskId);
    } else if (check.status === "unknown_dependency") {
      unknown.push(check);
    } else {
      blocked.push(check);
    }
  }
  return { readyIds, blocked, unknown };
}

export function formatCodeTaskDependencyQueueStartMessage(input: {
  readonly selectedCount: number;
  readonly partition: CodeTaskDependencyQueuePartition;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
}): string {
  const blockedCount = input.partition.blocked.length + input.partition.unknown.length;
  if (!blockedCount) return "";
  const lines = [
    "선택한 CodeTask 중 선행 작업이 완료되지 않은 항목이 있습니다.",
    "",
    `실행 가능: ${input.partition.readyIds.length}개`,
    `차단: ${blockedCount}개`,
  ];
  if (input.partition.blocked.length) {
    lines.push("", "차단 항목:");
    for (const item of input.partition.blocked) {
      const title =
        input.codeTaskPlan.tasks.find((t) => t.codeTaskId === item.codeTaskId)?.title ??
        item.codeTaskId;
      lines.push(`- ${item.codeTaskId} · ${title} · ${item.message ?? "선행 작업 필요"}`);
    }
  }
  if (input.partition.unknown.length) {
    lines.push("", "알 수 없는 dependency:");
    for (const item of input.partition.unknown) {
      lines.push(
        `- ${item.codeTaskId} · ${item.unknownDependencyIds.join(", ") || "unknown dependency"}`,
      );
    }
  }
  return lines.join("\n");
}

export function formatCodeTaskDependencyTreeHint(
  check: CodeTaskDependencyCheckResult,
  codeTaskPlan?: ImplementationCodeTaskPlanV1 | null,
): string | undefined {
  if (check.status === "ready") return undefined;
  if (check.status === "unknown_dependency") {
    return `알 수 없는 dependency: ${check.unknownDependencyIds.join(", ")}`;
  }
  const blocker = check.incompleteCodeTaskIds[0];
  if (!blocker) return check.message;

  const depTitle = codeTaskPlan
    ? codeTaskPlan.tasks.find((t) => t.codeTaskId === blocker)?.title ??
      codeTaskPlan.tasks.find((t) => t.parentTaskId === blocker)?.title ??
      blocker
    : blocker;
  return `${depTitle} 완료 후 실행 가능`;
}
