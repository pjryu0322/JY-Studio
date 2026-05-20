/**
 * Timeline grouping for orchestration observability.
 */

export type OrchestrationTimelineGroup =
  | "Intent Routing"
  | "Guard"
  | "Dispatch"
  | "Clarification"
  | "Recommendation"
  | "Artifact"
  | "Recovery"
  | "Compaction";

export function orchestrationTimelineGroupForAction(action: string): OrchestrationTimelineGroup {
  if (action === "intentRouterGuard") return "Intent Routing";
  if (/clarification/i.test(action)) return "Clarification";
  if (/recommend/i.test(action)) return "Recommendation";
  if (/artifact/i.test(action)) return "Artifact";
  if (/recover/i.test(action)) return "Recovery";
  if (/compact/i.test(action)) return "Compaction";
  if (/guard/i.test(action)) return "Guard";
  if (/dispatch|mutation/i.test(action)) return "Dispatch";
  return "Intent Routing";
}

export function formatOrchestrationTimelineResponse(input: {
  readonly group: OrchestrationTimelineGroup;
  readonly detail: string;
  readonly humanReadableReason?: string;
  readonly humanReadableGuardReason?: string;
  readonly humanReadableFallbackReason?: string;
  readonly lifecycleNote?: string;
}): string {
  const parts = [
    `orchestrationGroup:${input.group}`,
    input.detail,
    input.humanReadableReason ? `humanReadableReason:${input.humanReadableReason}` : "",
    input.humanReadableGuardReason ? `humanReadableGuardReason:${input.humanReadableGuardReason}` : "",
    input.humanReadableFallbackReason ? `humanReadableFallbackReason:${input.humanReadableFallbackReason}` : "",
    input.lifecycleNote ? `lifecycle:${input.lifecycleNote}` : "",
  ];
  return parts.filter(Boolean).join(" ");
}
