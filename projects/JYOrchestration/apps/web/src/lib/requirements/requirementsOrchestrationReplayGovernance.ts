/**
 * Replay snapshot retention — bounded history with importance tiers.
 */

import type { OrchestrationReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplay";
import {
  MAX_REPLAY_CRITICAL_ENTRIES,
  MAX_REPLAY_HISTORY_ENTRIES,
} from "@/lib/requirements/requirementsOrchestrationConstants";

export type ReplayImportance = "critical" | "normal" | "summary";

export type GovernedReplaySnapshot = OrchestrationReplaySnapshot &
  Readonly<{
    readonly replayImportance: ReplayImportance;
  }>;

export function replayImportanceForTransition(transition: string | undefined): ReplayImportance {
  if (!transition) return "normal";
  if (/dispatch:|route:clarification|guard:block/i.test(transition)) return "critical";
  if (/compact|summary/i.test(transition)) return "summary";
  return "normal";
}

export function appendReplayWithRetention(input: {
  readonly history: readonly GovernedReplaySnapshot[] | undefined;
  readonly snapshot: GovernedReplaySnapshot;
}): readonly GovernedReplaySnapshot[] {
  const next = [...(input.history ?? []), input.snapshot];
  const critical = next.filter((s) => s.replayImportance === "critical");
  const normal = next.filter((s) => s.replayImportance === "normal");
  const summary = next.filter((s) => s.replayImportance === "summary");

  const keptCritical = critical.slice(-MAX_REPLAY_CRITICAL_ENTRIES);
  const budget = MAX_REPLAY_HISTORY_ENTRIES - keptCritical.length;
  const keptNormal = normal.slice(-Math.max(0, Math.floor(budget * 0.7)));
  const keptSummary = summary.slice(-Math.max(0, budget - keptNormal.length));

  return [...keptCritical, ...keptNormal, ...keptSummary]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(-MAX_REPLAY_HISTORY_ENTRIES);
}

export function summarizeReplayHistory(
  history: readonly GovernedReplaySnapshot[] | undefined,
): GovernedReplaySnapshot | null {
  if (!history?.length) return null;
  const oldest = history[0]!;
  const newest = history[history.length - 1]!;
  return {
    beforeStateSummary: oldest.beforeStateSummary,
    afterStateSummary: newest.afterStateSummary,
    at: newest.at,
    replayImportance: "summary",
    decisionSource: "replay-retention",
    agentRole: "orchestration-planner",
    actorId: "system",
    triggerMessage: `summarized:${history.length}`,
  };
}
