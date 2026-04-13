/**
 * JYOrchestration — application facade over use-cases (route-ready; still no HTTP here).
 *
 * Public method names and result-code contracts are preserved.
 * This file delegates to `src/application/usecases/*` for a clearer user journey structure.
 */

import { mvpPrepareExecutionUseCase } from "./usecases/mvpPrepareExecutionUseCase";
import { mvpStartExecutionUseCase } from "./usecases/mvpStartExecutionUseCase";
import {
  mvpGetExecutionRunDetailUseCase,
  mvpGetExecutionRunSummaryUseCase,
  mvpGetExecutionStepListUseCase,
} from "./usecases/mvpGetExecutionStatusUseCase";
import { mvpGetExecutionInspectionUseCase } from "./usecases/mvpGetExecutionInspectionUseCase";
import type {
  GetReadinessRequest,
  GetReadinessResult,
  GetRunDetailRequest,
  GetRunDetailResult,
  GetRunInspectionRequest,
  GetRunInspectionResult,
  GetRunSummaryRequest,
  GetRunSummaryResult,
  GetStepListRequest,
  GetStepListResult,
  StartRunRequest,
  StartRunResult,
} from "./mvpExecutionContracts";

/** Marker for tests documenting that this layer is JYOrchestration-local only. */
export const MVP_EXECUTION_APPLICATION_LAYER_ID = "jyorchestration:application:mvp-execution" as const;

export class MvpExecutionApplicationService {
  /** @query */
  async getReadiness(req: GetReadinessRequest): Promise<GetReadinessResult> {
    return await mvpPrepareExecutionUseCase(req);
  }

  /** @command */
  async startRun(req: StartRunRequest): Promise<StartRunResult> {
    return await mvpStartExecutionUseCase(req);
  }

  /** @query */
  async getRunSummary(req: GetRunSummaryRequest): Promise<GetRunSummaryResult> {
    return await mvpGetExecutionRunSummaryUseCase(req);
  }

  /** @query */
  async getRunDetail(req: GetRunDetailRequest): Promise<GetRunDetailResult> {
    return await mvpGetExecutionRunDetailUseCase(req);
  }

  /** @query */
  async getStepList(req: GetStepListRequest): Promise<GetStepListResult> {
    return await mvpGetExecutionStepListUseCase(req);
  }

  /** @query */
  async getRunInspection(req: GetRunInspectionRequest): Promise<GetRunInspectionResult> {
    return await mvpGetExecutionInspectionUseCase(req);
  }
}
