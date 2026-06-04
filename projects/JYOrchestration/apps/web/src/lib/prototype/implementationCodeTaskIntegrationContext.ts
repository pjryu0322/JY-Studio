import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import {
  evaluateImplementationIntegrationEligibility,
  type ImplementationIntegrationEligibility,
} from "@/lib/prototype/implementationIntegrationEligibility";
import { buildTaskCursorExecutionsForIntegration } from "@/lib/prototype/implementationIntegrationService";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

/** CodeTask 통합·Preview eligibility 계산에 필요한 orchestration 필드 묶음 */
export type CodeTaskIntegrationSource = Readonly<{
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistory?: readonly TaskCursorExecutionV1[] | null;
  readonly autoQualityGate?: ImplementationAutoQualityGateV1 | null;
}>;

export function evaluateCodeTaskIntegration(
  source: CodeTaskIntegrationSource,
): ImplementationIntegrationEligibility {
  return evaluateImplementationIntegrationEligibility({
    codeTaskPlan: source.codeTaskPlan ?? null,
    taskList: source.taskList ?? null,
    codeTaskRuns: source.codeTaskRuns ?? null,
    taskCursorExecutions: buildTaskCursorExecutionsForIntegration({
      current: source.taskCursorExecution ?? null,
      history: source.taskCursorExecutionHistory ?? null,
    }),
    autoQualityGate: source.autoQualityGate ?? null,
  });
}

export function resolveIntegrationPipelineUnlocked(source: CodeTaskIntegrationSource): boolean {
  if (!source.taskList) return false;
  return evaluateCodeTaskIntegration(source).canIntegrate;
}
