import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type ImplementationIntegrationEligibility = Readonly<
  ReturnType<typeof selectCompletedCodeTasksForIntegration>
>;

export function evaluateImplementationIntegrationEligibility(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly taskCursorExecutions?: readonly TaskCursorExecutionV1[] | null;
  readonly autoQualityGate?: ImplementationAutoQualityGateV1 | null;
}): ImplementationIntegrationEligibility {
  return selectCompletedCodeTasksForIntegration({
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
    taskCursorExecutions: input.taskCursorExecutions,
    autoQualityGate: input.autoQualityGate,
  });
}
