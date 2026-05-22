/**
 * Dedupe runtime timeline rows (memory + DB duplicates).
 */

import type { RuntimeTimelineRow } from "@/lib/runtime/runtimeObservability";

function timelineDedupeKey(row: RuntimeTimelineRow): string {
  const detail =
    row.detail && typeof row.detail === "object" && !Array.isArray(row.detail)
      ? JSON.stringify(row.detail)
      : "";
  const createdBucket = row.createdAt.slice(0, 19);
  return `${createdBucket}|${row.eventType}|${row.workerName ?? ""}|${detail}`;
}

export function dedupeRuntimeTimelineRows(rows: readonly RuntimeTimelineRow[]): RuntimeTimelineRow[] {
  const seen = new Set<string>();
  const out: RuntimeTimelineRow[] = [];
  for (const row of rows) {
    const key = timelineDedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
