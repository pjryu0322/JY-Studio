/**
 * In-memory store for BusinessExecutionRun event timeline (latest run only per session).
 *
 * This is intentionally transient. Do NOT persist Stage1/Stage2 logs here.
 */

import type { BusinessExecutionRunEvent } from "@/lib/workflow/businessExecutionRunEvent";
import { getSessionEntry, updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";

type RunEventTimelineEntry = {
  latestRunId?: string;
  events?: BusinessExecutionRunEvent[];
  updatedAtIso?: string;
};

export function appendSessionBusinessExecutionRunEvent(
  sessionId: string,
  runId: string,
  event: BusinessExecutionRunEvent
): void {
  const at = new Date().toISOString();
  updateSessionEntry<RunEventTimelineEntry>(sessionId, (prev) => {
    const prevRunId = prev?.latestRunId;
    const baseEvents = prevRunId === runId ? (prev?.events ?? []) : [];
    return {
      ...(prev ?? {}),
      latestRunId: runId,
      events: [...baseEvents, event],
      updatedAtIso: at,
    };
  });
}

export function resolveSessionBusinessExecutionRunEvents(
  sessionId: string | null | undefined,
  runId: string | null | undefined
): BusinessExecutionRunEvent[] {
  if (!sessionId || !runId) return [];
  const entry = getSessionEntry<RunEventTimelineEntry>(sessionId);
  if (!entry || entry.latestRunId !== runId) return [];
  const events = entry.events ?? [];
  // Ensure chronological order (stable).
  return [...events].sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
}

