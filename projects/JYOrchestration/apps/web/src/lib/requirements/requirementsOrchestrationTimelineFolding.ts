/**
 * Timeline folding — group counts and summary traces to limit explosion.
 */

import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { OrchestrationTimelineGroup } from "@/lib/requirements/requirementsOrchestrationTimeline";
import {
  buildOrchestrationTimelineViewModel,
  type OrchestrationTimelineViewRow,
} from "@/lib/requirements/requirementsOrchestrationTimelineView";
import { MAX_TIMELINE_ROWS_PER_GROUP } from "@/lib/requirements/requirementsOrchestrationConstants";

export type FoldedOrchestrationTimelineGroup = Readonly<{
  readonly group: OrchestrationTimelineGroup;
  readonly count: number;
  readonly folded: boolean;
  readonly summaryEntry?: RequirementsPromptTimelineEntry;
  readonly visibleRows: readonly OrchestrationTimelineViewRow[];
  readonly hiddenCount: number;
}>;

export function buildSummaryTraceEntry(input: {
  readonly group: OrchestrationTimelineGroup;
  readonly count: number;
  readonly oldestAt: string;
  readonly newestAt: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "service-flow",
    action: "orchestrationTimelineSummary",
    source: "system",
    provider: "internal",
    createdAt: input.newestAt,
    orchestrationTraceGroup: input.group,
    routingDecision: "summary",
    responseText: [
      `orchestrationGroup:${input.group}`,
      `summaryCount:${input.count}`,
      `summaryRange:${input.oldestAt}..${input.newestAt}`,
      "humanReadableReason:이전 오케스트레이션 trace를 요약했습니다.",
    ].join(" "),
  };
}

export function buildFoldedOrchestrationTimeline(
  entries: readonly RequirementsPromptTimelineEntry[],
  maxPerGroup = MAX_TIMELINE_ROWS_PER_GROUP,
): readonly FoldedOrchestrationTimelineGroup[] {
  const vm = buildOrchestrationTimelineViewModel(entries);
  return vm.groups.map((g) => {
    const rows = g.rows;
    const hiddenCount = Math.max(0, rows.length - maxPerGroup);
    const visibleRows = hiddenCount > 0 ? rows.slice(0, maxPerGroup) : rows;
    const oldest = rows[rows.length - 1]?.entry.createdAt ?? rows[0]?.entry.createdAt ?? "";
    const newest = rows[0]?.entry.createdAt ?? "";
    return {
      group: g.group,
      count: rows.length,
      folded: hiddenCount > 0,
      summaryEntry:
        hiddenCount > 0 ?
          buildSummaryTraceEntry({ group: g.group, count: rows.length, oldestAt: oldest, newestAt: newest })
        : undefined,
      visibleRows,
      hiddenCount,
    };
  });
}
