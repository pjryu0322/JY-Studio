import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const PROMPT_TIMELINE_MAX_ENTRIES = 120;
const DEFAULT_PROMPT_TIMELINE_FINGERPRINT_WINDOW = 50;

export function isValidPromptTimelineEntry(
  entry: RequirementsPromptTimelineEntry | null | undefined,
): entry is RequirementsPromptTimelineEntry {
  return (
    entry != null &&
    typeof entry === "object" &&
    typeof entry.action === "string" &&
    entry.action.length > 0
  );
}

export function sanitizePromptTimelineEntries(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): RequirementsPromptTimelineEntry[] {
  return (timeline ?? []).filter(isValidPromptTimelineEntry);
}

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
  if (!isValidPromptTimelineEntry(entry)) {
    return sanitizePromptTimelineEntries(existing);
  }
  return [...sanitizePromptTimelineEntries(existing), entry].slice(-PROMPT_TIMELINE_MAX_ENTRIES);
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
  if (!isValidPromptTimelineEntry(entry)) return "";
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
  const recent = sanitizePromptTimelineEntries(timeline).slice(-fingerprintWindow);
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
    return sanitizePromptTimelineEntries(existing);
  }
  return appendPromptTimeline(existing, normalized);
}

export function appendPromptTimelineEntriesOnce(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entries: readonly RequirementsPromptTimelineEntry[],
  options?: { readonly fingerprintWindow?: number },
): RequirementsPromptTimelineEntry[] {
  let timeline = sanitizePromptTimelineEntries(existing);
  for (const entry of entries) {
    if (!isValidPromptTimelineEntry(entry)) continue;
    timeline = appendPromptTimelineEntryOnce(timeline, entry, options);
  }
  return timeline;
}
