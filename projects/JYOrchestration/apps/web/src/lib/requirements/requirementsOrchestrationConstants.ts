/** Orchestration runtime limits — phase 3 compaction & safety. */

export const INTENT_ORCHESTRATION_WIRE_VERSION = 1 as const;

export const INTENT_ROUTER_CACHE_SCHEMA_VERSION = 1;

export const ORCHESTRATION_FOCUS_STALE_TURNS = 8;

export const ORCHESTRATION_ALTERNATE_FOCUS_STALE_HITS = 2;

export const CLARIFICATION_TIMEOUT_MS = 15 * 60 * 1000;

export const CLARIFICATION_UNRELATED_MESSAGE_MAX = 3;

export const MAX_ORCHESTRATION_RECOMMENDATIONS = 8;

export const MAX_CHAT_PRIORITIZED_RECOMMENDATIONS = 1;

export const MAX_ARCHIVED_FOCUSES = 5;

export const MAX_RECENT_TRANSITIONS = 12;

export const MAX_ORCHESTRATION_SUMMARY_CHARS = 2000;

export const MAX_ARTIFACT_LIFECYCLE_ENTRIES = 32;

export const RECOMMENDATION_COOLDOWN_MS = 10 * 60 * 1000;

export const MAX_TIMELINE_ROWS_PER_GROUP = 5;

export const MAX_ORCHESTRATION_PROMPT_TIMELINE = 80;

/** Phase 4 product runtime — bounded replay, lineage, dependency graph. */
export const MAX_REPLAY_HISTORY_ENTRIES = 50;

export const MAX_REPLAY_CRITICAL_ENTRIES = 12;

export const MAX_ARTIFACT_LINEAGE_ACTIVE = 8;

export const MAX_ARTIFACT_DEPENDENCY_EDGES = 24;

export const DEFAULT_INSTRUMENTATION_LEVEL = "standard" as const;

export type InstrumentationLevel = "minimal" | "standard" | "debug";
