/**
 * MVP — project-level orchestration and execution readiness (isolated, unwired).
 */

import { getExecutableTasks } from "../task/taskService";

export interface ExecutionReadinessInput {
  projectId: string;
}

export interface ExecutionReadinessResult {
  projectId: string;
  isReady: boolean;
  blockers: string[];
}

export interface ProjectExecutionSummaryInput {
  projectId: string;
}

export interface ProjectExecutionSummaryStub {
  projectId: string;
  /** TODO: populate when MVP persistence exists */
  placeholder: true;
}

/**
 * Readiness: at least one executable task (FUNCTIONAL + CONFIRMED), finite unique `finalOrder` on those tasks.
 * Uses the same registry semantics as `getExecutableTasks` (explicit empty seed => no tasks).
 */
export async function evaluateExecutionReadiness(
  input: ExecutionReadinessInput
): Promise<ExecutionReadinessResult> {
  const blockers: string[] = [];
  const executable = await getExecutableTasks(input.projectId);

  if (executable.length === 0) {
    blockers.push("NO_EXECUTABLE_TASKS");
  }

  const orders = executable.map((t) => t.finalOrder);
  if (orders.some((o) => typeof o !== "number" || !Number.isFinite(o))) {
    blockers.push("INVALID_FINAL_ORDER");
  }

  const seen = new Set<number>();
  for (const o of orders) {
    if (seen.has(o)) {
      blockers.push("DUPLICATE_FINAL_ORDER");
      break;
    }
    seen.add(o);
  }

  return {
    projectId: input.projectId,
    isReady: blockers.length === 0,
    blockers,
  };
}

export async function summarizeProjectExecution(
  _input: ProjectExecutionSummaryInput
): Promise<ProjectExecutionSummaryStub> {
  return { projectId: _input.projectId, placeholder: true };
}
