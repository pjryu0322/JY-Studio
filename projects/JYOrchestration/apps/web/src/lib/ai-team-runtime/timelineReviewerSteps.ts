import type { ExecutionReviewerStepRecord } from "@/lib/execution/executionReviewWithAiMembers";

/** Defensive parse for timeline — malformed rows are dropped, never throws. */
export function coerceReviewerStepsForTimeline(raw: unknown): readonly ExecutionReviewerStepRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ExecutionReviewerStepRecord[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const role = (row as { role?: unknown }).role;
    if (typeof role !== "string" || !role.trim()) continue;
    out.push(row as ExecutionReviewerStepRecord);
  }
  return out;
}
