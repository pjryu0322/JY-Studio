/**
 * In-process runtime timeline buffer (execRunId-scoped).
 * Used when executionEventLog has no executionJobId or progress log file is off.
 */

export type RuntimeTimelineStoredEntry = {
  readonly createdAt: string;
  readonly source: "runtime_event";
  readonly eventType: string;
  readonly status?: string;
  readonly workerName?: string | null;
  readonly message?: string | null;
  readonly detail?: unknown;
};

const MAX_PER_RUN = 120;
const store = new Map<string, RuntimeTimelineStoredEntry[]>();

export function recordRuntimeTimelineEntry(
  execRunId: string,
  entry: Omit<RuntimeTimelineStoredEntry, "createdAt"> & { createdAt?: string }
): void {
  const row: RuntimeTimelineStoredEntry = {
    createdAt: entry.createdAt ?? new Date().toISOString(),
    source: entry.source,
    eventType: entry.eventType,
    status: entry.status,
    workerName: entry.workerName ?? null,
    message: entry.message ?? null,
    detail: entry.detail,
  };
  const list = store.get(execRunId) ?? [];
  list.push(row);
  if (list.length > MAX_PER_RUN) {
    list.splice(0, list.length - MAX_PER_RUN);
  }
  store.set(execRunId, list);
}

export function getRuntimeTimelineFromStore(execRunId: string): readonly RuntimeTimelineStoredEntry[] {
  return [...(store.get(execRunId) ?? [])];
}

/** Test-only reset */
export function clearRuntimeTimelineStore(): void {
  store.clear();
}
