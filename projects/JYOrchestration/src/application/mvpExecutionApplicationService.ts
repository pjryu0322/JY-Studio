/**
 * JYOrchestration — thin application service over the isolated MVP orchestration surface.
 * Depends only on MVP facade, DTOs, and inspection view model (no routes, no Prisma, no other packages).
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
  async getReadiness(req: GetReadinessRequest): Promise<GetReadinessResult> {
    const readiness = await mvpCheckReadinessDto({ projectId: req.projectId });
    return { readiness };
  }

  async startRun(req: StartRunRequest): Promise<StartRunResult> {
    const r = await mvpStartRunIfReady(req.projectId);
    if (!r.ok) {
      return { ok: false, reason: "NOT_READY", readiness: r.readiness };
    }
    return { ok: true, runId: r.run.id, readiness: r.readiness };
  }

  async getRunSummary(req: GetRunSummaryRequest): Promise<GetRunSummaryResult> {
    const summary = await mvpGetRunSummaryDto(req.runId);
    return { summary };
  }

  async getRunDetail(req: GetRunDetailRequest): Promise<GetRunDetailResult> {
    const detail = await mvpGetRunDetailDto(req.runId);
    return { detail };
  }

  async getStepList(req: GetStepListRequest): Promise<GetStepListResult> {
    const steps = mvpGetStepSummaryDtos(req.runId);
    const stepFlowSummary = mvpGetStepFlowSummary(req.runId);
    return { steps, stepFlowSummary };
  }

  async getRunInspection(req: GetRunInspectionRequest): Promise<GetRunInspectionResult> {
    const inspection = await mvpBuildRunInspectionViewModel({
      projectId: req.projectId,
      runId: req.runId,
    });
    return { inspection };
  }
}
