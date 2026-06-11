import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  buildImplementationExecutionSummaryCounts,
  type ImplementationExecutionSummaryCountsV1,
} from "@/lib/prototype/implementationExecutionSummary";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Integration footer, runtime snapshot, and task-tree unit rows — not checkbox/runnable UI gates
 * (those use `summarizeCodeTaskBoardRowsFromTreeNodes`).
 */
export type BuildImplementationBoardExecutionContextInputV1 = Readonly<{
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly legacySelectedTaskIds?: readonly string[] | null;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly workItemCount?: number;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
}>;

export function buildImplementationBoardExecutionContext(
  input: BuildImplementationBoardExecutionContextInputV1,
): ImplementationExecutionSummaryCountsV1 {
  return buildImplementationExecutionSummaryCounts({
    projectId: input.projectId,
    requirementsState: input.requirementsState,
    codeTaskPlan: input.codeTaskPlan,
    legacySelectedTaskIds: input.legacySelectedTaskIds,
    runs: input.runs,
    workItemCount: input.workItemCount,
    previewRuntime: input.previewRuntime,
  });
}
