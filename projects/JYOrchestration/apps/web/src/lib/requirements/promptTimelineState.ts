import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const PROMPT_TIMELINE_MAX_ENTRIES = 120;
const DEFAULT_PROMPT_TIMELINE_FINGERPRINT_WINDOW = 50;

export const DETERMINISTIC_PLATFORM_TIMELINE_META = {
  source: "platform",
  provider: "platform",
  model: "deterministic",
} as const;

/** requirementsStateJson.promptTimeline에 엔트리를追加합니다. */
export function appendPromptTimeline(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entry: RequirementsPromptTimelineEntry,
): RequirementsPromptTimelineEntry[] {
  return [...(existing ?? []), entry].slice(-PROMPT_TIMELINE_MAX_ENTRIES);
}

export function withDeterministicPlatformTimelineMeta(
  entry: RequirementsPromptTimelineEntry,
): RequirementsPromptTimelineEntry {
  return {
    ...entry,
    source: DETERMINISTIC_PLATFORM_TIMELINE_META.source,
    provider: DETERMINISTIC_PLATFORM_TIMELINE_META.provider,
    model: DETERMINISTIC_PLATFORM_TIMELINE_META.model,
  };
}

export function buildPromptTimelineEntryFingerprint(
  entry: RequirementsPromptTimelineEntry,
): string {
  return [
    entry.action,
    entry.responseText ?? "",
    entry.routingDecision ?? "",
    entry.orchestrationTraceGroup ?? "",
  ].join("|");
}

export function hasPromptTimelineFingerprint(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  fingerprint: string,
  fingerprintWindow = DEFAULT_PROMPT_TIMELINE_FINGERPRINT_WINDOW,
): boolean {
  const recent = (timeline ?? []).slice(-fingerprintWindow);
  return recent.some((entry) => buildPromptTimelineEntryFingerprint(entry) === fingerprint);
}

export function appendPromptTimelineEntryOnce(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entry: RequirementsPromptTimelineEntry,
  options?: {
    readonly fingerprint?: string;
    readonly fingerprintWindow?: number;
  },
): RequirementsPromptTimelineEntry[] {
  const normalized = withDeterministicPlatformTimelineMeta(entry);
  const entryFingerprint = buildPromptTimelineEntryFingerprint(normalized);
  const fingerprint = options?.fingerprint ?? entryFingerprint;
  const window = options?.fingerprintWindow ?? DEFAULT_PROMPT_TIMELINE_FINGERPRINT_WINDOW;
  if (
    hasPromptTimelineFingerprint(existing, fingerprint, window) ||
    hasPromptTimelineFingerprint(existing, entryFingerprint, window)
  ) {
    return [...(existing ?? [])];
  }
  return appendPromptTimeline(existing, normalized);
}

export function appendPromptTimelineEntriesOnce(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entries: readonly RequirementsPromptTimelineEntry[],
  options?: { readonly fingerprintWindow?: number },
): RequirementsPromptTimelineEntry[] {
  let timeline = existing ?? [];
  for (const entry of entries) {
    timeline = appendPromptTimelineEntryOnce(timeline, entry, options);
  }
  return timeline;
}
