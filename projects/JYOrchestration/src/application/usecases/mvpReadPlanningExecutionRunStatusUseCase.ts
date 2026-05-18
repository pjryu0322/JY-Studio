/**
 * Planning-originated execution — use-case: read run-status summary by runId.
 *
 * This wraps the existing MVP run readers and maps into a UI-friendly contract.
 */

import { mvpGetExecutionRunSummaryUseCase } from "./mvpGetExecutionStatusUseCase";
import { mvpGetExecutionStepListUseCase } from "./mvpGetExecutionStatusUseCase";
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

    const s = r.summary;
    const steps = await mvpGetExecutionStepListUseCase({ runId });
    const lastStep =
      steps.ok && steps.steps.length > 0 ? steps.steps[steps.steps.length - 1] : null;

    const status: "RUNNING" | "COMPLETED" | "FAILED" =
      s.runStatus === "RUNNING" ? "RUNNING" : s.runStatus === "SUCCESS" ? "COMPLETED" : "FAILED";

    const progressPercent =
      s.totalTasks > 0 ? Math.max(0, Math.min(100, Math.round((s.completedTasks / s.totalTasks) * 100))) : 0;

    return {
      ok: true,
      run: {
        runId: s.runId,
        status,
        totalTasks: s.totalTasks,
        completedTasks: s.completedTasks,
        currentStep: lastStep ? `${lastStep.sequence}:${lastStep.stepType}` : null,
        totalSteps: s.totalStepCount,
        progressPercent,
        lastMessage: s.lastFailureMessage ?? (lastStep ? lastStep.message : null),
        canRetry: status === "FAILED",
        canInspect: true,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: "UNEXPECTED_ERROR", message: `실행 상태 조회 중 오류: ${msg}` };
  }
}

