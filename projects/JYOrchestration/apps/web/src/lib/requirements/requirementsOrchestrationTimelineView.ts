/**
 * Prompt timeline view model — orchestration trace groups for UI.
 */

import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  isOrchestrationTraceTimelineAction,
  ORCHESTRATION_TIMELINE_ACTIONS,
} from "@/lib/requirements/promptTimelineActionCatalog";
import {
  orchestrationTimelineGroupForAction,
  type OrchestrationTimelineGroup,
} from "@/lib/requirements/requirementsOrchestrationTimeline";

export { ORCHESTRATION_TIMELINE_ACTIONS };

export type OrchestrationTimelineParsedDetail = Readonly<{
  readonly routerMode?: string;
  readonly routingReason?: string;
  readonly guardReason?: string;
  readonly fallbackReason?: string;
  readonly humanReadableReason?: string;
  readonly humanReadableGuardReason?: string;
  readonly humanReadableFallbackReason?: string;
  readonly orchestrationGroup?: string;
}>;

export type OrchestrationTimelineViewRow = Readonly<{
  readonly entry: RequirementsPromptTimelineEntry;
  readonly group: OrchestrationTimelineGroup;
  readonly parsed: OrchestrationTimelineParsedDetail;
}>;

export type OrchestrationTimelineViewModel = Readonly<{
  readonly groups: readonly Readonly<{
    readonly group: OrchestrationTimelineGroup;
    readonly rows: readonly OrchestrationTimelineViewRow[];
  }>[];
}>;

export function isOrchestrationTraceTimelineEntry(
  entry: { readonly action?: string; readonly orchestrationTraceGroup?: string } | null | undefined,
): boolean {
  if (!entry) return false;
  if (entry.orchestrationTraceGroup) return true;
  return isOrchestrationTraceTimelineAction(String(entry.action ?? ""));
}

function pickTimelineField(text: string, key: string): string | undefined {
  const token = `${key}:`;
  const idx = text.indexOf(token);
  if (idx < 0) return undefined;
  const start = idx + token.length;
  const rest = text.slice(start);
  const next = rest.search(/\s+[a-zA-Z][a-zA-Z0-9]*:/);
  const raw = (next < 0 ? rest : rest.slice(0, next)).trim();
  return raw || undefined;
}

export function parseOrchestrationTimelineDetail(responseText: string | undefined): OrchestrationTimelineParsedDetail {
  const text = String(responseText ?? "");
  return {
    routerMode: pickTimelineField(text, "routerMode"),
    routingReason: pickTimelineField(text, "routingReason") ?? pickTimelineField(text, "intentReason"),
    guardReason: pickTimelineField(text, "guardReason"),
    fallbackReason: pickTimelineField(text, "fallbackReason"),
    humanReadableReason: pickTimelineField(text, "humanReadableReason"),
    humanReadableGuardReason: pickTimelineField(text, "humanReadableGuardReason"),
    humanReadableFallbackReason: pickTimelineField(text, "humanReadableFallbackReason"),
    orchestrationGroup: pickTimelineField(text, "orchestrationGroup"),
  };
}

export function pickOrchestrationPromptTimelineEntries(
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  limit = 40,
): RequirementsPromptTimelineEntry[] {
  const list = Array.isArray(promptTimeline) ? promptTimeline : [];
  return list.filter((x) => isOrchestrationTraceTimelineEntry(x)).slice(-limit).reverse();
}

const GROUP_ORDER: readonly OrchestrationTimelineGroup[] = [
  "Recovery",
  "Intent Routing",
  "Guard",
  "Clarification",
  "Recommendation",
  "Dispatch",
  "Artifact",
  "Compaction",
];

export function buildOrchestrationTimelineViewModel(
  entries: readonly RequirementsPromptTimelineEntry[],
): OrchestrationTimelineViewModel {
  const rows: OrchestrationTimelineViewRow[] = entries.map((entry) => {
    const group =
      (entry.orchestrationTraceGroup as OrchestrationTimelineGroup | undefined) ??
      orchestrationTimelineGroupForAction(entry.action);
    return {
      entry,
      group,
      parsed: parseOrchestrationTimelineDetail(entry.responseText),
    };
  });

  const byGroup = new Map<OrchestrationTimelineGroup, OrchestrationTimelineViewRow[]>();
  for (const row of rows) {
    const list = byGroup.get(row.group) ?? [];
    list.push(row);
    byGroup.set(row.group, list);
  }

  const groups = GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => ({
    group,
    rows: byGroup.get(group) ?? [],
  }));

  for (const [group, list] of byGroup) {
    if (!GROUP_ORDER.includes(group)) {
      groups.push({ group, rows: list });
    }
  }

  return { groups };
}

export function buildOrchestrationRecoveryTimelineEntry(input: {
  readonly sessionId?: string;
  readonly recoveredAt: string;
}): RequirementsPromptTimelineEntry {
  const session = input.sessionId ? `session:${input.sessionId.slice(0, 12)}` : "";
  return {
    stage: "service-flow",
    stageGroup: "service-planning",
    workspaceScreenKey: "service_flow_workshop",
    action: "orchestrationRecovery",
    source: "system",
    provider: "internal",
    createdAt: input.recoveredAt,
    orchestrationTraceGroup: "Recovery",
    routingDecision: "recovery",
    responseText: [
      "orchestrationGroup:Recovery",
      "routerMode:recovery",
      `humanReadableReason:오케스트레이션 상태를 복구했습니다. ${session}`.trim(),
      input.recoveredAt ? `recoveredAt:${input.recoveredAt}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
