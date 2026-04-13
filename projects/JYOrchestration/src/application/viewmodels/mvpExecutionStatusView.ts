/**
 * JYOrchestration — execution status composition view.
 * Makes the relationship explicit between summary/detail/steps/flow/inspection.
 *
 * No DTO shapes are changed; this is a pure composition helper.
 */

import type {
  MvpExecutionStepDto,
  MvpRunDetailDto,
  MvpRunSummaryDto,
} from "../../mvp/contracts/mvpDtos";
import type { MvpRunInspectionViewModel } from "../../mvp/orchestration/mvpRunInspectionViewModel";

export type MvpExecutionStatusView = {
  runId: string;
  summary: MvpRunSummaryDto | null;
  detail: MvpRunDetailDto | null;
  steps: MvpExecutionStepDto[];
  stepFlowSummary: string;
  inspection: MvpRunInspectionViewModel | null;
};

export function buildMvpExecutionStatusView(input: {
  runId: string;
  summary: MvpRunSummaryDto | null;
  detail: MvpRunDetailDto | null;
  steps: MvpExecutionStepDto[];
  stepFlowSummary: string;
  inspection: MvpRunInspectionViewModel | null;
}): MvpExecutionStatusView {
  return {
    runId: input.runId,
    summary: input.summary,
    detail: input.detail,
    steps: input.steps,
    stepFlowSummary: input.stepFlowSummary,
    inspection: input.inspection,
  };
}

