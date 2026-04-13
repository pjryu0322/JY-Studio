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
  async getReadiness(req: GetReadinessRequest): Promise<GetReadinessResult> {
    const projectId = normalizeProjectId(req.projectId);
    if (!projectId) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID };
    }
    const readiness = await mvpCheckReadinessDto({ projectId });
    return { ok: true, code: MVP_EXECUTION_APP_CODE.OK, readiness };
  }

  async startRun(req: StartRunRequest): Promise<StartRunResult> {
    const projectId = normalizeProjectId(req.projectId);
    if (!projectId) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID };
    }
    const r = await mvpStartRunIfReady(projectId);
    if (!r.ok) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.NOT_READY, readiness: r.readiness };
    }
    return { ok: true, code: MVP_EXECUTION_APP_CODE.OK, runId: r.run.id, readiness: r.readiness };
  }

  async getRunSummary(req: GetRunSummaryRequest): Promise<GetRunSummaryResult> {
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };
    }
    const summary = await mvpGetRunSummaryDto(runId);
    if (!summary) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND };
    }
    return { ok: true, code: MVP_EXECUTION_APP_CODE.OK, summary };
  }

  async getRunDetail(req: GetRunDetailRequest): Promise<GetRunDetailResult> {
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };
    }
    const detail = await mvpGetRunDetailDto(runId);
    if (!detail) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND };
    }
    return { ok: true, code: MVP_EXECUTION_APP_CODE.OK, detail };
  }

  async getStepList(req: GetStepListRequest): Promise<GetStepListResult> {
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };
    }
    const summary = await mvpGetRunSummaryDto(runId);
    if (!summary) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND };
    }
    const steps = mvpGetStepSummaryDtos(runId);
    const stepFlowSummary = mvpGetStepFlowSummary(runId);
    return { ok: true, code: MVP_EXECUTION_APP_CODE.OK, steps, stepFlowSummary };
  }

  async getRunInspection(req: GetRunInspectionRequest): Promise<GetRunInspectionResult> {
    const projectId = normalizeProjectId(req.projectId);
    if (!projectId) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID };
    }
    const runId = normalizeRunId(req.runId);
    if (!runId) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.INVALID_RUN_ID };
    }
    const summary = await mvpGetRunSummaryDto(runId);
    if (!summary) {
      return { ok: false, code: MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND };
    }
    const inspection = await mvpBuildRunInspectionViewModel({
      projectId,
      runId,
    });
    return { ok: true, code: MVP_EXECUTION_APP_CODE.OK, inspection };
  }
}
