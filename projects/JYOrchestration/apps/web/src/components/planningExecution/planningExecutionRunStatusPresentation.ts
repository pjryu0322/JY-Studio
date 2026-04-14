import type { PlanningExecutionRunStatusResponse } from "@jy-orch/application/public";

export type PlanningExecutionRunStatusPresentation = Readonly<{
  /** Strong one-line product summary. */
  summaryLine: string;
  /** Secondary short hint for what to do next. */
  hintLine: string | null;
  /** UI tone for the summary block. */
  tone: "neutral" | "success" | "danger";
  /** Stable label for the status chip. */
  statusLabel: string;
}>;

export function buildPlanningExecutionRunStatusPresentation(input: {
  run: (PlanningExecutionRunStatusResponse & { ok: true })["run"];
}): PlanningExecutionRunStatusPresentation {
  const s = input.run.status;
  if (s === "RUNNING") {
    return {
      tone: "neutral",
      statusLabel: "실행 중",
      summaryLine: "실행이 진행 중입니다",
      hintLine: "새로고침으로 최신 상태를 확인할 수 있습니다.",
    };
  }
  if (s === "COMPLETED") {
    return {
      tone: "success",
      statusLabel: "완료",
      summaryLine: "실행이 완료되었습니다",
      hintLine: null,
    };
  }
  return {
    tone: "danger",
    statusLabel: "실패",
    summaryLine: "실행 중 오류가 발생했습니다",
    hintLine: "원인을 확인하거나 다시 시도할 수 있습니다.",
  };
}

