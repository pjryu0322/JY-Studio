import { evaluateTaskCursorJobObservability } from "@/lib/prototype/taskCursorJobObservability";
import type { TaskCursorJobObservability } from "@/lib/prototype/taskCursorJobObservability";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";

export type TaskCursorExecutionJobSummaryVm = Readonly<{
  readonly headline: string;
  readonly lastCheckedLabel?: string;
  readonly observability: TaskCursorJobObservability;
}>;

function formatLastCheckedLabel(lastPollAt: string | null | undefined): string | undefined {
  const raw = String(lastPollAt ?? "").trim();
  if (!raw) return undefined;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return `마지막 확인: ${new Date(parsed).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function buildTaskCursorExecutionJobSummaryVm(input: {
  readonly serverPolling: boolean;
  readonly serverJob?: TaskCursorJobSummary | null;
  readonly now?: Date;
}): TaskCursorExecutionJobSummaryVm | null {
  const observability = evaluateTaskCursorJobObservability(input);
  if (!observability.serverPolling || !observability.activeJobId) {
    return null;
  }

  const headline = observability.stuck ? "서버 Worker 추적 지연" : "서버 Worker 추적 중";
  const lastCheckedLabel = formatLastCheckedLabel(observability.lastPollAt);

  return {
    headline,
    ...(lastCheckedLabel ? { lastCheckedLabel } : {}),
    observability,
  };
}

export function formatTaskCursorExecutionJobBoardLabel(
  vm: TaskCursorExecutionJobSummaryVm | null | undefined,
): string | undefined {
  if (!vm) return undefined;
  const parts = [vm.headline];
  if (vm.lastCheckedLabel) parts.push(vm.lastCheckedLabel);
  if (vm.observability.stuck) parts.push("지연");
  return parts.join(" · ");
}
