/**
 * Quick Design confirm / implementation prep pseudo-progress (client-only).
 *
 * TODO(product): async job + polling for real batch completion counts
 * (POST quick-design/confirm → jobId → GET progress snapshot).
 */

export type ImplementationPrepProgressPhase =
  | "idle"
  | "seed_building"
  | "task_list_building"
  | "codetask_refining"
  | "workitem_building"
  | "preflight_checking"
  | "ready"
  | "failed";

export type ImplementationPrepProgressSnapshot = Readonly<{
  readonly phase: ImplementationPrepProgressPhase;
  readonly label: string;
  readonly detail?: string;
  readonly percent: number;
  readonly estimatedRemainingLabel?: string;
  readonly stepLabels: readonly string[];
  readonly completedStepCount: number;
}>;

const PSEUDO_PHASES: readonly Readonly<{
  readonly key: ImplementationPrepProgressPhase;
  readonly label: string;
  readonly startPercent: number;
  readonly endPercent: number;
}>[] = [
  { key: "seed_building", label: "구현 Seed 생성", startPercent: 10, endPercent: 25 },
  { key: "task_list_building", label: "구현 TaskList 생성", startPercent: 25, endPercent: 40 },
  {
    key: "codetask_refining",
    label: "CodeTask LLM 정제",
    startPercent: 40,
    endPercent: 85,
  },
  { key: "workitem_building", label: "WorkItem 생성", startPercent: 85, endPercent: 95 },
  { key: "preflight_checking", label: "Preflight 확인", startPercent: 95, endPercent: 100 },
];

/** Monotonic pseudo progress from elapsed time during a single confirm request. */
export function buildPseudoImplementationPrepProgress(elapsedMs: number): ImplementationPrepProgressSnapshot {
  const elapsed = Math.max(0, elapsedMs);
  const rampMs = 90_000;
  const rawPercent = Math.min(99, 10 + Math.floor((elapsed / rampMs) * 89));

  let phase: ImplementationPrepProgressPhase = "seed_building";
  let label = PSEUDO_PHASES[0]?.label ?? "구현준비 생성";
  let completedStepCount = 0;

  for (const step of PSEUDO_PHASES) {
    if (rawPercent >= step.endPercent) {
      completedStepCount += 1;
      phase = step.key;
      label = step.label;
    } else if (rawPercent >= step.startPercent) {
      phase = step.key;
      label = step.label;
      break;
    }
  }

  const detail =
    phase === "codetask_refining"
      ? "Batch 기준으로 처리 중입니다. 예상 소요: 1~2분"
      : undefined;

  return {
    phase,
    label,
    detail,
    percent: rawPercent,
    estimatedRemainingLabel: phase === "codetask_refining" ? "약 1~2분" : undefined,
    stepLabels: PSEUDO_PHASES.map((s) => s.label),
    completedStepCount,
  };
}
