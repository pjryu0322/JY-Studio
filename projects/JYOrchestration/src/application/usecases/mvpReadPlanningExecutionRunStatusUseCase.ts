/**
 * Planning-originated execution — use-case: read run-status summary by runId.
 *
 * This wraps the existing MVP run summary reader and maps it into a UI/route-safe contract.
 */

import { mvpGetExecutionRunSummaryUseCase } from "./mvpGetExecutionStatusUseCase";
import type { PlanningExecutionRunStatusResponse } from "../contracts/planningExecutionRunStatusResponse";

export async function mvpReadPlanningExecutionRunStatusUseCase(req: {
  readonly runId: string;
}): Promise<PlanningExecutionRunStatusResponse> {
  const runId = String(req.runId ?? "").trim();
  if (!runId) {
    return { ok: false, error: "INVALID_RUN_ID", message: "runId가 필요합니다." };
  }

  try {
    const r = await mvpGetExecutionRunSummaryUseCase({ runId });
    if (!r.ok) {
      const code = r.code;
      if (code === "INVALID_RUN_ID") {
        return { ok: false, error: "INVALID_RUN_ID", message: "runId가 올바르지 않습니다." };
      }
      if (code === "RUN_NOT_FOUND") {
        return { ok: false, error: "RUN_NOT_FOUND", message: "해당 run을 찾을 수 없습니다." };
      }
      return { ok: false, error: "UNEXPECTED_ERROR", message: "실행 상태 조회에 실패했습니다." };
    }

    const s = r.value.summary;
    return {
      ok: true,
      run: {
        runId: s.runId,
        runStatus: s.runStatus,
        totalTasks: s.totalTasks,
        completedTasks: s.completedTasks,
        failedTasks: s.failedTasks,
        currentTaskId: s.currentTaskId,
        lastFailureMessage: s.lastFailureMessage,
        totalStepCount: s.totalStepCount,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: "UNEXPECTED_ERROR", message: `실행 상태 조회 중 오류: ${msg}` };
  }
}

