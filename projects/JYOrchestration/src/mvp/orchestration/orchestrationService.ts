/**
 * MVP — project-level execution readiness helpers (**target** path; used by `mvpOrchestrationFacade`).
 *
 * Not to be confused with Stage1/Stage2 (those live under `apps/web`, outside this package).
 */

import { mvpExecutionPortsBundle } from "../runtime/mvpExecutionPortsBundle";

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
 * Readiness: at least one executable task from `TaskProvider.getExecutableTasks(projectId)`;
 * each task’s `finalOrder` must be finite, non-negative, and unique in that list.
 * Uses the bundle’s `TaskProvider` so readiness matches injected adapters (e.g. tests, future API-backed registry).
 */
export async function evaluateExecutionReadiness(
  input: ExecutionReadinessInput
): Promise<ExecutionReadinessResult> {
  const blockers: string[] = [];
  const executable = await mvpExecutionPortsBundle().tasks.getExecutableTasks(input.projectId);

  if (executable.length === 0) {
    blockers.push("NO_EXECUTABLE_TASKS");
  }

  const orders = executable.map((t) => t.finalOrder);
  if (orders.some((o) => typeof o !== "number" || !Number.isFinite(o))) {
    blockers.push("INVALID_FINAL_ORDER");
  }
  if (orders.some((o) => Number.isFinite(o) && o < 0)) {
    blockers.push("FINAL_ORDER_NEGATIVE");
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
