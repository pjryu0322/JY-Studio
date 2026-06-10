import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { evaluateSelectedRunnableCodeTasksGate } from "@/lib/prototype/implementationRunnableCodeTaskSelection";

export function evaluateQuickRunExecutionSelectionGate(input: {
  readonly selectedCodeTaskIds: readonly string[];
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly units?: readonly ImplementationExecutionUnitV1[] | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly progressByCodeTaskId?: ReadonlyMap<string, { readonly statusLabel: string; readonly progressLabel: string }>;
}): ReturnType<typeof evaluateSelectedRunnableCodeTasksGate> {
  return evaluateSelectedRunnableCodeTasksGate(input);
}
