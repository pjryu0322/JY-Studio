/**
 * JYOrchestration — thin application service over the isolated MVP orchestration surface.
 * Depends only on MVP facade, DTOs, and inspection view model (no routes, no Prisma, no other packages).
 *
 * CQRS (see `mvpExecutionApplicationCqrs.ts`):
 * - **Command:** `startRun` — may create a new MVP run and drive execution.
 * - **Queries:** `getReadiness`, `getRunSummary`, `getRunDetail`, `getStepList`, `getRunInspection` — read-only.
 */

import { mvpBuildRunInspectionViewModel } from "../mvp/orchestration/mvpRunInspectionViewModel";
import {
  mvpCheckReadinessDto,
  mvpGetRunDetailDto,
  mvpGetRunSummaryDto,
  mvpGetStepFlowSummary,
  mvpGetStepSummaryDtos,
  mvpStartRunIfReady,
} from "../mvp/orchestration/mvpOrchestrationFacade";
import { appFailureResult, appSuccessResult } from "./mvpAppResultHelpers";
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
import { MVP_EXECUTION_APP_CODE } from "./mvpExecutionResultCodes";

/** Marker for tests documenting that this layer is JYOrchestration-local only. */
export const MVP_EXECUTION_APPLICATION_LAYER_ID = "jyorchestration:application:mvp-execution" as const;

function normalizeProjectId(projectId: string): string | null {
  const t = projectId.trim();
  return t.length > 0 ? t : null;
}

function normalizeRunId(runId: string): string | null {
  const t = runId.trim();
  return t.length > 0 ? t : null;
}

export class MvpExecutionApplicationService {
  /** @query */
  async getReadiness(req: GetReadinessRequest): Promise<GetReadinessResult> {
    const projectId = normalizeProjectId(req.projectId);
    if (!projectId) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID) as GetReadinessResult;
    }
    const readiness = await mvpCheckReadinessDto({ projectId });
    return appSuccessResult({ readiness }) as GetReadinessResult;
  }

  /** @command */
  async startRun(req: StartRunRequest): Promise<StartRunResult> {
    const projectId = normalizeProjectId(req.projectId);
    if (!projectId) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID) as StartRunResult;
    }
    const r = await mvpStartRunIfReady(projectId);
    if (!r.ok) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.NOT_READY, { readiness: r.readiness }) as StartRunResult;
    }
    return appSuccessResult({ runId: r.run.id, readiness: r.readiness }) as StartRunResult;
  }

  /** @query */
  async getRunSummary(req: GetRunSummaryRequest): Promise<GetRunSummaryResult> {
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetRunSummaryResult;
    }
    const summary = await mvpGetRunSummaryDto(runId);
    if (!summary) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetRunSummaryResult;
    }
    return appSuccessResult({ summary }) as GetRunSummaryResult;
  }

  /** @query */
  async getRunDetail(req: GetRunDetailRequest): Promise<GetRunDetailResult> {
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetRunDetailResult;
    }
    const detail = await mvpGetRunDetailDto(runId);
    if (!detail) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetRunDetailResult;
    }
    return appSuccessResult({ detail }) as GetRunDetailResult;
  }

  /** @query */
  async getStepList(req: GetStepListRequest): Promise<GetStepListResult> {
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetStepListResult;
    }
    const summary = await mvpGetRunSummaryDto(runId);
    if (!summary) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetStepListResult;
    }
    const steps = mvpGetStepSummaryDtos(runId);
    const stepFlowSummary = mvpGetStepFlowSummary(runId);
    return appSuccessResult({ steps, stepFlowSummary }) as GetStepListResult;
  }

  /** @query */
  async getRunInspection(req: GetRunInspectionRequest): Promise<GetRunInspectionResult> {
    const projectId = normalizeProjectId(req.projectId);
    if (!projectId) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID) as GetRunInspectionResult;
    }
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetRunInspectionResult;
    }
    const summary = await mvpGetRunSummaryDto(runId);
    if (!summary) {
      return appFailureResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetRunInspectionResult;
    }
    const inspection = await mvpBuildRunInspectionViewModel({
      projectId,
      runId,
    });
    return appSuccessResult({ inspection }) as GetRunInspectionResult;
  }
}
