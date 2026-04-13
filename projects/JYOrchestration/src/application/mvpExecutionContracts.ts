/**
 * JYOrchestration — internal application-layer contracts for MVP execution (no HTTP, no DB).
 * Responses wrap stable MVP DTOs from `src/mvp`.
 */

import type {
  MvpExecutionStepDto,
  MvpReadinessDto,
  MvpRunDetailDto,
  MvpRunSummaryDto,
} from "../mvp/contracts/mvpDtos";
import type { MvpRunInspectionViewModel } from "../mvp/orchestration/mvpRunInspectionViewModel";

export type GetReadinessRequest = {
  projectId: string;
};

export type GetReadinessResult = {
  readiness: MvpReadinessDto;
};

export type StartRunRequest = {
  projectId: string;
};

export type StartRunResult =
  | { ok: true; runId: string; readiness: MvpReadinessDto }
  | { ok: false; reason: "NOT_READY"; readiness: MvpReadinessDto };

export type GetRunSummaryRequest = {
  runId: string;
};

export type GetRunSummaryResult = {
  summary: MvpRunSummaryDto | null;
};

export type GetRunDetailRequest = {
  runId: string;
};

export type GetRunDetailResult = {
  detail: MvpRunDetailDto | null;
};

export type GetStepListRequest = {
  runId: string;
};

export type GetStepListResult = {
  steps: MvpExecutionStepDto[];
  stepFlowSummary: string;
};

export type GetRunInspectionRequest = {
  projectId: string;
  runId: string;
};

export type GetRunInspectionResult = {
  inspection: MvpRunInspectionViewModel;
};
