/**
 * JYOrchestration — use-case: prepare execution (readiness + preconditions).
 */

import { mvpCheckReadinessDto } from "../../mvp/orchestration/mvpOrchestrationFacade";
import type { GetReadinessRequest, GetReadinessResult } from "../mvpExecutionContracts";
import { MVP_EXECUTION_APP_CODE } from "../mvpExecutionResultCodes";
import { failResult, okResult } from "../resultFactories";

function normalizeProjectId(projectId: string): string | null {
  const t = projectId.trim();
  return t.length > 0 ? t : null;
}

export async function mvpPrepareExecutionUseCase(req: GetReadinessRequest): Promise<GetReadinessResult> {
  const projectId = normalizeProjectId(req.projectId);
  if (!projectId) {
    return failResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID) as GetReadinessResult;
  }
  const readiness = await mvpCheckReadinessDto({ projectId });
  return okResult({ readiness }) as GetReadinessResult;
}

