/**
 * MVP — consolidated internal view model for future API/UI inspection (no HTTP layer).
 */

import type {
  MvpExecutionStepDto,
  MvpReadinessDto,
  MvpRunDetailDto,
  MvpRunSummaryDto,
} from "../contracts/mvpDtos";
import type { ExecutionReadinessInput } from "./orchestrationService";
import {
  mvpCheckReadinessDto,
  mvpGetRunDetailDto,
  mvpGetRunSummaryDto,
  mvpGetStepFlowSummary,
  mvpGetStepSummaryDtos,
} from "./mvpOrchestrationFacade";

export type MvpRunInspectionViewModel = {
  projectId: string;
  runId: string;
  readiness: MvpReadinessDto;
  runSummary: MvpRunSummaryDto | null;
  runDetail: MvpRunDetailDto | null;
  steps: MvpExecutionStepDto[];
  stepFlowSummary: string;
};

export type MvpBuildRunInspectionInput = ExecutionReadinessInput & {
  runId: string;
};

/**
 * Loads readiness for the project plus all run-scoped read models for `runId` in one call shape.
 */
export async function mvpBuildRunInspectionViewModel(
  input: MvpBuildRunInspectionInput
): Promise<MvpRunInspectionViewModel> {
  const readiness = await mvpCheckReadinessDto({ projectId: input.projectId });
  const [runSummary, runDetail] = await Promise.all([
    mvpGetRunSummaryDto(input.runId),
    mvpGetRunDetailDto(input.runId),
  ]);
  const steps = mvpGetStepSummaryDtos(input.runId);
  const stepFlowSummary = mvpGetStepFlowSummary(input.runId);
  return {
    projectId: input.projectId,
    runId: input.runId,
    readiness,
    runSummary,
    runDetail,
    steps,
    stepFlowSummary,
  };
}
