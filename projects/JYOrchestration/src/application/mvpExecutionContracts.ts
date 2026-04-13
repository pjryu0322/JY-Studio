/**
 * JYOrchestration — internal application-layer contracts for MVP execution (no HTTP, no DB).
 * Each result discriminates success vs validation / domain failures using `MVP_EXECUTION_APP_CODE`.
 */

import type {
  MvpExecutionStepDto,
  MvpReadinessDto,
  MvpRunDetailDto,
  MvpRunSummaryDto,
} from "../mvp/contracts/mvpDtos";
import type { MvpRunInspectionViewModel } from "../mvp/orchestration/mvpRunInspectionViewModel";
import { MVP_EXECUTION_APP_CODE } from "./mvpExecutionResultCodes";

export type GetReadinessRequest = {
  projectId: string;
};

export type GetReadinessResult =
  | { ok: true; code: typeof MVP_EXECUTION_APP_CODE.OK; readiness: MvpReadinessDto }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID };

export type StartRunRequest = {
  projectId: string;
};

export type StartRunResult =
  | { ok: true; code: typeof MVP_EXECUTION_APP_CODE.OK; runId: string; readiness: MvpReadinessDto }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.NOT_READY; readiness: MvpReadinessDto }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID };

export type GetRunSummaryRequest = {
  runId: string;
};

export type GetRunSummaryResult =
  | { ok: true; code: typeof MVP_EXECUTION_APP_CODE.OK; summary: MvpRunSummaryDto }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };

export type GetRunDetailRequest = {
  runId: string;
};

export type GetRunDetailResult =
  | { ok: true; code: typeof MVP_EXECUTION_APP_CODE.OK; detail: MvpRunDetailDto }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };

export type GetStepListRequest = {
  runId: string;
};

export type GetStepListResult =
  | {
      ok: true;
      code: typeof MVP_EXECUTION_APP_CODE.OK;
      steps: MvpExecutionStepDto[];
      stepFlowSummary: string;
    }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };

export type GetRunInspectionRequest = {
  projectId: string;
  runId: string;
};

export type GetRunInspectionResult =
  | { ok: true; code: typeof MVP_EXECUTION_APP_CODE.OK; inspection: MvpRunInspectionViewModel }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID }
  | { ok: false; code: typeof MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };
