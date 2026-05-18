/**
 * JYOrchestration — use-case: consolidated inspection VM access.
 */

import { mvpBuildRunInspectionViewModel } from "../../mvp/orchestration/mvpRunInspectionViewModel";
import { mvpGetRunSummaryDto } from "../../mvp/orchestration/mvpOrchestrationFacade";
import type { GetRunInspectionRequest, GetRunInspectionResult } from "../mvpExecutionContracts";
import { MVP_EXECUTION_APP_CODE } from "../mvpExecutionResultCodes";
import { failResult, okResult } from "../resultFactories";

function normalizeProjectId(projectId: string): string | null {
  const t = projectId.trim();
  return t.length > 0 ? t : null;
}

function normalizeRunId(runId: string): string | null {
  const t = runId.trim();
  return t.length > 0 ? t : null;
}

export async function mvpGetExecutionInspectionUseCase(req: GetRunInspectionRequest): Promise<GetRunInspectionResult> {
  const projectId = normalizeProjectId(req.projectId);
  if (!projectId) {
    return failResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID) as GetRunInspectionResult;
  }
  const runId = normalizeRunId(req.runId);
  if (!runId) {
    return failResult(MVP_EXECUTION_APP_CODE.INVALID_RUN_ID) as GetRunInspectionResult;
  }
  const summary = await mvpGetRunSummaryDto(runId);
  if (!summary) {
    return failResult(MVP_EXECUTION_APP_CODE.RUN_NOT_FOUND) as GetRunInspectionResult;
  }
  const inspection = await mvpBuildRunInspectionViewModel({ projectId, runId });
  return okResult({ inspection }) as GetRunInspectionResult;
}

