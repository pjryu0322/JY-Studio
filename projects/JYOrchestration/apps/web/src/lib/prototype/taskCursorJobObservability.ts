import { isActiveTaskCursorJobStatus } from "@/lib/prototype/taskCursorExecutionJobTypes";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";

export type TaskCursorJobObservability = Readonly<{
  readonly serverPolling: boolean;
  readonly activeJobId?: string;
  readonly jobStatus?: string;
  readonly lastPollAt?: string | null;
  readonly nextPollAt?: string | null;
  readonly pollCount?: number;
  readonly failureReason?: string | null;
  readonly lockedBy?: string | null;
  readonly lockExpiresAt?: string | null;
  readonly stuck: boolean;
  readonly lockedStale: boolean;
  readonly statusLabel?: string;
}>;

const STUCK_GRACE_MS = 2 * 60 * 1000;

export function evaluateTaskCursorJobObservability(input: {
  readonly serverPolling: boolean;
  readonly serverJob?: TaskCursorJobSummary | null;
  readonly now?: Date;
}): TaskCursorJobObservability {
  const job = input.serverJob;
  const now = input.now ?? new Date();
  if (!input.serverPolling || !job) {
    return { serverPolling: input.serverPolling, stuck: false, lockedStale: false };
  }

  const nextPollAtMs = job.nextPollAt ? Date.parse(job.nextPollAt) : NaN;
  const lockExpiresAtMs = job.lockExpiresAt ? Date.parse(job.lockExpiresAt) : NaN;
  const active = isActiveTaskCursorJobStatus(job.status);
  const stuck =
    active &&
    !job.lockedBy &&
    Number.isFinite(nextPollAtMs) &&
    nextPollAtMs < now.getTime() - STUCK_GRACE_MS;
  const lockedStale =
    Boolean(job.lockedBy) && Number.isFinite(lockExpiresAtMs) && lockExpiresAtMs < now.getTime();

  const parts = ["서버 Worker", job.status];
  if (job.pollCount > 0) parts.push(`${job.pollCount}회`);
  if (job.lastPollAt) parts.push(`last ${job.lastPollAt.slice(11, 19)}`);
  if (job.nextPollAt) parts.push(`next ${job.nextPollAt.slice(11, 19)}`);
  if (job.failureReason) parts.push(job.failureReason);
  if (stuck) parts.push("추적 지연");
  if (lockedStale) parts.push("lock stale");
  if (job.lockedBy) parts.push(`lock ${job.lockedBy}`);

  return {
    serverPolling: true,
    activeJobId: job.id,
    jobStatus: job.status,
    lastPollAt: job.lastPollAt ?? null,
    nextPollAt: job.nextPollAt ?? null,
    pollCount: job.pollCount,
    failureReason: job.failureReason ?? null,
    lockedBy: job.lockedBy ?? null,
    lockExpiresAt: job.lockExpiresAt ?? null,
    stuck,
    lockedStale,
    statusLabel: parts.join(" · "),
  };
}
