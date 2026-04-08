import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";

export type DisplayedAnalysis = { summary: string; notes: string[] };

export function isMeetingMinutesPayload(p: unknown): p is MeetingMinutesMock {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.summary === "string" &&
    Array.isArray(o.decisions) &&
    o.decisions.every((x) => typeof x === "string") &&
    Array.isArray(o.pending) &&
    o.pending.every((x) => typeof x === "string") &&
    Array.isArray(o.excluded) &&
    o.excluded.every((x) => typeof x === "string")
  );
}

export function isAnalysisPayload(p: unknown): p is DisplayedAnalysis {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return typeof o.summary === "string" && Array.isArray(o.notes) && o.notes.every((x) => typeof x === "string");
}

export function isIdeasPayload(p: unknown): p is { ideas: string[] } {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return Array.isArray(o.ideas) && o.ideas.every((x) => typeof x === "string");
}

/** Mock-only rows for “suggested from ideas” — not official derived features. */
export function ideaStringsToSuggestedFeatures(ideas: string[], seed: number): FeatureMock[] {
  return ideas.map((text, idx) => ({
    id: `suggest-idea-${seed}-${idx}`,
    name: text.length > 52 ? `${text.slice(0, 49)}…` : text,
    description: text,
    status: "DRAFT" as const,
    userFlow: [],
    nonFunctional: [],
  }));
}
