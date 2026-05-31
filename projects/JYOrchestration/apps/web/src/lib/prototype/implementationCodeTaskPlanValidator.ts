import {
  IMPLEMENTATION_CODE_TASK_CHANGE_TYPES,
  IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
  IMPLEMENTATION_CODE_TASK_STATUSES,
  type ImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskPlanValidationReportV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

function developerTaskIds(taskList: ImplementationTaskListV1): ReadonlySet<string> {
  return new Set(
    (taskList.tasks ?? [])
      .filter((task) => task.ownerRole === "developer")
      .map((task) => String(task.taskId ?? "").trim())
      .filter(Boolean),
  );
}

function allTaskIds(taskList: ImplementationTaskListV1): ReadonlySet<string> {
  return new Set(
    (taskList.tasks ?? [])
      .map((task) => String(task.taskId ?? "").trim())
      .filter(Boolean),
  );
}

export function validateImplementationCodeTaskPlan(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso?: string;
}): ImplementationCodeTaskPlanValidationReportV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const errors: string[] = [];
  const warnings: string[] = [];
  const plan = input.plan;
  const devTaskIds = developerTaskIds(input.taskList);
  const taskIds = allTaskIds(input.taskList);

  if (plan.version !== IMPLEMENTATION_CODE_TASK_PLAN_VERSION) {
    errors.push("invalid plan version");
  }
  if (!String(plan.projectId ?? "").trim()) {
    errors.push("missing projectId");
  }

  const codeTaskIds = new Set(
    (plan.tasks ?? []).map((task) => String(task.codeTaskId ?? "").trim()).filter(Boolean),
  );
  if (codeTaskIds.size !== (plan.tasks ?? []).length) {
    errors.push("duplicate or missing codeTaskId");
  }

  for (const task of plan.tasks ?? []) {
    const codeTaskId = String(task.codeTaskId ?? "").trim();
    const parentTaskId = String(task.parentTaskId ?? "").trim();

    if (!codeTaskId) {
      errors.push("missing codeTaskId");
      continue;
    }
    if (!parentTaskId) {
      errors.push(`missing parentTaskId for ${codeTaskId}`);
    } else if (!devTaskIds.has(parentTaskId)) {
      errors.push(`unknown parentTaskId: ${parentTaskId}`);
    }

    if (!IMPLEMENTATION_CODE_TASK_CHANGE_TYPES.includes(task.changeType)) {
      errors.push(`invalid changeType for ${codeTaskId}`);
    }
    if (!String(task.title ?? "").trim()) {
      errors.push(`missing title for ${codeTaskId}`);
    }
    if (!String(task.description ?? "").trim()) {
      errors.push(`missing description for ${codeTaskId}`);
    }
    if (!(task.targetHints?.length ?? 0)) {
      errors.push(`missing targetHints for ${codeTaskId}`);
    }
    if (!(task.acceptanceCriteria?.length ?? 0)) {
      errors.push(`missing acceptanceCriteria for ${codeTaskId}`);
    }
    if (!(task.verificationHints?.length ?? 0)) {
      errors.push(`missing verificationHints for ${codeTaskId}`);
    }
    if (!(task.forbiddenPaths?.length ?? 0)) {
      errors.push(`missing forbiddenPaths for ${codeTaskId}`);
    }
    if (!IMPLEMENTATION_CODE_TASK_STATUSES.includes(task.status)) {
      errors.push(`invalid status for ${codeTaskId}`);
    }

    const parentDeps = task.parentTaskDependencies ?? [];
    for (const dep of parentDeps) {
      if (!taskIds.has(dep)) {
        errors.push(`unknown parentTaskDependency: ${dep}`);
      }
    }

    const codeDeps = task.codeTaskDependencies ?? [];
    for (const dep of codeDeps) {
      if (dep === codeTaskId) {
        errors.push(`self dependency: ${codeTaskId}`);
      } else if (!codeTaskIds.has(dep)) {
        errors.push(`unknown codeTaskDependency: ${dep}`);
      }
    }

    for (const dep of task.dependencies ?? []) {
      if (dep === codeTaskId) {
        errors.push(`self dependency in dependencies: ${codeTaskId}`);
      }
    }
  }

  if (!plan.tasks.length) {
    errors.push("no code tasks");
  }
  if (devTaskIds.size > 0 && !plan.tasks.length) {
    errors.push("developer tasks exist but no code tasks");
  }

  return {
    status: errors.length ? "failed" : "passed",
    checkedAt: now,
    errors,
    warnings,
  };
}
