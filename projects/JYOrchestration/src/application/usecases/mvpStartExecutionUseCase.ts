/**
 * JYOrchestration — use-case: start execution (validated run start).
 */

import { mvpStartRunIfReady } from "../../mvp/orchestration/mvpOrchestrationFacade";
import type { StartRunRequest, StartRunResult } from "../mvpExecutionContracts";
import { MVP_EXECUTION_APP_CODE } from "../mvpExecutionResultCodes";
import { failResult, okResult } from "../resultFactories";

function normalizeProjectId(projectId: string): string | null {
  const t = projectId.trim();
  return t.length > 0 ? t : null;
}

export async function mvpStartExecutionUseCase(req: StartRunRequest): Promise<StartRunResult> {
  const projectId = normalizeProjectId(req.projectId);
  if (!projectId) {
    return failResult(MVP_EXECUTION_APP_CODE.INVALID_PROJECT_ID) as StartRunResult;
  }
  const r = await mvpStartRunIfReady(projectId);
  if (!r.ok) {
    return failResult(MVP_EXECUTION_APP_CODE.NOT_READY, { readiness: r.readiness }) as StartRunResult;
  }
  return okResult({ runId: r.run.id, readiness: r.readiness }) as StartRunResult;
}

