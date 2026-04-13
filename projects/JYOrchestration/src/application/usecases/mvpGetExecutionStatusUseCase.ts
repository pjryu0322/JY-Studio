/**
 * JYOrchestration — use-case: execution status reads (summary/detail/steps/flow).
 */

import {
  mvpGetRunDetailDto,
  mvpGetRunSummaryDto,
  mvpGetStepFlowSummary,
  mvpGetStepSummaryDtos,
} from "../../mvp/orchestration/mvpOrchestrationFacade";
import type {
  GetRunDetailRequest,
  GetRunDetailResult,
  GetRunSummaryRequest,
  GetRunSummaryResult,
  GetStepListRequest,
  GetStepListResult,
} from "../mvpExecutionContracts";
import { MVP_EXECUTION_APP_CODE } from "../mvpExecutionResultCodes";
import { failResult, okResult } from "../resultFactories";

function normalizeRunId(runId: string): string | null {
  const t = runId.trim();
  return t.length > 0 ? t : null;
}

export async function mvpGetExecutionRunSummaryUseCase(req: GetRunSummaryRequest): Promise<GetRunSummaryResult> {
  const runId = normalizeRunId(req.runId);
  if (!runId) {
    return failResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetRunSummaryResult;
  }
  const summary = await mvpGetRunSummaryDto(runId);
  if (!summary) {
    return failResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetRunSummaryResult;
  }
  return okResult({ summary }) as GetRunSummaryResult;
}

export async function mvpGetExecutionRunDetailUseCase(req: GetRunDetailRequest): Promise<GetRunDetailResult> {
  const runId = normalizeRunId(req.runId);
  if (!runId) {
    return failResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetRunDetailResult;
  }
  const detail = await mvpGetRunDetailDto(runId);
  if (!detail) {
    return failResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetRunDetailResult;
  }
  return okResult({ detail }) as GetRunDetailResult;
}

export async function mvpGetExecutionStepListUseCase(req: GetStepListRequest): Promise<GetStepListResult> {
  const runId = normalizeRunId(req.runId);
  if (!runId) {
    return failResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetStepListResult;
  }
  const summary = await mvpGetRunSummaryDto(runId);
  if (!summary) {
    return failResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetStepListResult;
  }
  const steps = mvpGetStepSummaryDtos(runId);
  const stepFlowSummary = mvpGetStepFlowSummary(runId);
  return okResult({ steps, stepFlowSummary }) as GetStepListResult;
}

