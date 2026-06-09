import { buildImplementationUiToastTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export function normalizeImplementationUiToastMessage(message: string): string {
  return String(message ?? "").replace(/\s+/g, " ").trim();
}

export function appendImplementationUiToastToPromptTimeline(input: {
  readonly priorTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined;
  readonly projectId: string;
  readonly message: string;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const message = normalizeImplementationUiToastMessage(input.message);
  const projectId = input.projectId.trim();
  if (!message || !projectId) {
    return [...(input.priorTimeline ?? [])];
  }
  const entry = buildImplementationUiToastTimelineEntry({
    projectId,
    message,
    nowIso: input.nowIso,
  });
  return appendPromptTimeline(input.priorTimeline, entry);
}
