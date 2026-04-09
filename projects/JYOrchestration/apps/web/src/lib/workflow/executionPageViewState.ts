/**
 * Page-ready view helpers for /execution (lightweight).
 *
 * Keep the page focused on rendering by centralizing repetitive null/currency checks.
 * Business execution domain only — not Stage1/Stage2.
 */

import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import type { BusinessExecutionRunEvent } from "@/lib/workflow/businessExecutionRunEvent";
import { resolveSessionBusinessExecutionRunEvents } from "@/lib/workflow/collaborationSessionResultStore";

export function getExecutionRunTimelineViewState(input: {
  sessionId: string | null;
  run: BusinessExecutionRun | undefined;
  isRunCurrent: boolean;
  maxEvents?: number;
}): { events: BusinessExecutionRunEvent[] } {
  if (!input.sessionId || !input.run || !input.isRunCurrent) return { events: [] };
  const all = resolveSessionBusinessExecutionRunEvents(input.sessionId, input.run.runId);
  const max = input.maxEvents ?? 8;
  return { events: all.slice(Math.max(0, all.length - max)) };
}

