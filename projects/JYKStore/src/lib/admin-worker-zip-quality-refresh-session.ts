/**
 * Browser-session tracker for Worker ZIP quality refresh.
 *
 * The Admin UI unmounts when navigating between inbox queues/packs, but the
 * quality-refresh POST is long and already persists reports server-side.
 * Keeping the in-flight Promise (and last result) in a module map lets the
 * panel reattach after remount without cancelling or losing the outcome.
 */
import {
  runAdminWorkerZipQualityRefresh,
  type AdminWorkerZipQualityRefreshResult,
} from "@/lib/admin-review-api";

export type QualityRefreshSessionJob =
  | {
      status: "running";
      startedAt: number;
      promise: Promise<AdminWorkerZipQualityRefreshResult>;
    }
  | {
      status: "done";
      startedAt: number;
      finishedAt: number;
      result: AdminWorkerZipQualityRefreshResult;
    }
  | {
      status: "error";
      startedAt: number;
      finishedAt: number;
      message: string;
    };

const jobs = new Map<string, QualityRefreshSessionJob>();

export function getQualityRefreshSessionJob(
  packId: string,
): QualityRefreshSessionJob | null {
  const key = packId.trim();
  if (!key) return null;
  return jobs.get(key) ?? null;
}

export function isQualityRefreshSessionRunning(packId: string): boolean {
  return getQualityRefreshSessionJob(packId)?.status === "running";
}

export function clearQualityRefreshSessionJob(packId: string): void {
  const key = packId.trim();
  if (!key) return;
  jobs.delete(key);
}

/**
 * Start (or reuse) a quality-refresh POST for this pack. Concurrent callers
 * share the same Promise so navigation remounts do not spawn a second run.
 */
export function startQualityRefreshSessionJob(
  packId: string,
): Promise<AdminWorkerZipQualityRefreshResult> {
  const key = packId.trim();
  const existing = jobs.get(key);
  if (existing?.status === "running") return existing.promise;

  const startedAt = Date.now();
  const promise = runAdminWorkerZipQualityRefresh(key)
    .then((result) => {
      const current = jobs.get(key);
      // Ignore stale completion if a newer run replaced this job.
      if (current?.status === "running" && current.promise === promise) {
        jobs.set(key, {
          status: "done",
          startedAt,
          finishedAt: Date.now(),
          result,
        });
      }
      return result;
    })
    .catch((err: unknown) => {
      const current = jobs.get(key);
      if (current?.status === "running" && current.promise === promise) {
        jobs.set(key, {
          status: "error",
          startedAt,
          finishedAt: Date.now(),
          message:
            err instanceof Error ? err.message : "품질 점검에 실패했습니다.",
        });
      }
      throw err;
    });

  jobs.set(key, { status: "running", startedAt, promise });
  return promise;
}

/** Heuristic step index from wall-clock so remount mid-run keeps progress. */
export function qualityRefreshProgressIndex(
  startedAt: number,
  nowMs: number,
  stepCount: number,
  stepTickMs: number,
): number {
  if (stepCount <= 0) return 0;
  const elapsed = Math.max(0, nowMs - startedAt);
  return Math.min(Math.floor(elapsed / stepTickMs), stepCount - 1);
}
