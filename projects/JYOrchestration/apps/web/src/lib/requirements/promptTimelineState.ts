import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const PROMPT_TIMELINE_MAX_ENTRIES = 120;

/** requirementsStateJson.promptTimeline에 엔트리를追加합니다. */
export function appendPromptTimeline(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entry: RequirementsPromptTimelineEntry,
): RequirementsPromptTimelineEntry[] {
  return [...(existing ?? []), entry].slice(-PROMPT_TIMELINE_MAX_ENTRIES);
}
