/**
 * Runtime instrumentation — latency and cost metadata for timeline explainability.
 */

export type OrchestrationRuntimeMetrics = Readonly<{
  readonly routerMs?: number;
  readonly guardMs?: number;
  readonly projectionMs?: number;
  readonly persistMs?: number;
  readonly totalMs?: number;
  readonly cacheHit?: boolean;
  readonly projectionCost?: number;
  readonly persistCost?: number;
}>;

export function createOrchestrationTimer(): Readonly<{
  readonly mark: (label: string) => void;
  readonly finish: (extra?: Partial<OrchestrationRuntimeMetrics>) => OrchestrationRuntimeMetrics;
}> {
  const marks = new Map<string, number>();
  const start = Date.now();
  return {
    mark(label: string) {
      marks.set(label, Date.now());
    },
    finish(extra) {
      const end = Date.now();
      const routerMs = marks.has("router") ? (marks.get("post-router") ?? end) - (marks.get("router") ?? start) : undefined;
      const guardMs =
        marks.has("guard") && marks.has("post-guard") ?
          (marks.get("post-guard") ?? end) - (marks.get("guard") ?? start)
        : undefined;
      const projectionMs =
        marks.has("projection") && marks.has("post-projection") ?
          (marks.get("post-projection") ?? end) - (marks.get("projection") ?? start)
        : undefined;
      return {
        totalMs: end - start,
        ...(routerMs !== undefined ? { routerMs } : {}),
        ...(guardMs !== undefined ? { guardMs } : {}),
        ...(projectionMs !== undefined ? { projectionMs } : {}),
        ...extra,
      };
    },
  };
}

export function formatRuntimeMetricsForTimeline(metrics: OrchestrationRuntimeMetrics): string {
  return [
    metrics.totalMs !== undefined ? `durationMs:${metrics.totalMs}` : "",
    metrics.routerMs !== undefined ? `routerMs:${metrics.routerMs}` : "",
    metrics.guardMs !== undefined ? `guardMs:${metrics.guardMs}` : "",
    metrics.projectionMs !== undefined ? `projectionMs:${metrics.projectionMs}` : "",
    metrics.cacheHit ? "cacheHit:true" : "",
    metrics.projectionCost !== undefined ? `projectionCost:${metrics.projectionCost}` : "",
    metrics.persistCost !== undefined ? `persistCost:${metrics.persistCost}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
