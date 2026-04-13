/**
 * MVP — project-level orchestration and execution readiness (isolated, unwired).
 */

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

export async function evaluateExecutionReadiness(
  _input: ExecutionReadinessInput
): Promise<ExecutionReadinessResult> {
  return { projectId: _input.projectId, isReady: false, blockers: ["mvp stub"] };
}

export async function summarizeProjectExecution(
  _input: ProjectExecutionSummaryInput
): Promise<ProjectExecutionSummaryStub> {
  return { projectId: _input.projectId, placeholder: true };
}
