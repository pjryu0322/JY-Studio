import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export type KnowledgePipelineOpsDiagnostics = Readonly<{
  readonly sampleSize: number;
  readonly latestRunAt: string | null;
  readonly averageDurationMs: number | null;
  readonly recentFailureCount: number;
  readonly successRatePercent: number | null;
  readonly fallbackCount: number;
}>;

export function computeKnowledgePipelineOpsDiagnostics(
  runs: readonly KnowledgePipelineRunRecord[],
  sampleLimit = 20,
): KnowledgePipelineOpsDiagnostics {
  const sample = runs.slice(0, sampleLimit);
  if (!sample.length) {
    return {
      sampleSize: 0,
      latestRunAt: null,
      averageDurationMs: null,
      recentFailureCount: 0,
      successRatePercent: null,
      fallbackCount: 0,
    };
  }

  const durations = sample
    .map((r) => r.durationMs)
    .filter((ms): ms is number => ms != null && Number.isFinite(ms));
  const averageDurationMs =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  const completed = sample.filter((r) => r.status === "COMPLETED").length;
  const failed = sample.filter((r) => r.status === "FAILED").length;
  const terminal = completed + failed;
  const successRatePercent = terminal > 0 ? Math.round((completed / terminal) * 100) : null;

  return {
    sampleSize: sample.length,
    latestRunAt: sample[0]?.startedAt ?? null,
    averageDurationMs,
    recentFailureCount: failed,
    successRatePercent,
    fallbackCount: sample.filter((r) => r.persistenceMode === "MEMORY_FALLBACK").length,
  };
}
