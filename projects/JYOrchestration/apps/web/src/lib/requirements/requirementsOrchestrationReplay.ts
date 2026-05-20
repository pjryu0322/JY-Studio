/**
 * Orchestration replay snapshots — before/after summaries for debug timeline.
 */

import type { RequirementsIntentOrchestrationV1 } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export type ReplayImportance = "critical" | "normal" | "summary";

export type OrchestrationReplaySnapshot = Readonly<{
  readonly beforeStateSummary: string;
  readonly afterStateSummary: string;
  readonly triggerAction?: QuickActionId | null;
  readonly triggerMessage?: string;
  readonly at: string;
  readonly decisionSource?: string;
  readonly agentRole?: string;
  readonly actorId?: string;
  readonly replayImportance?: ReplayImportance;
}>;

export function summarizeOrchestrationState(orch: RequirementsIntentOrchestrationV1 | null | undefined): string {
  if (!orch) return "orch=null";
  const parts = [
    orch.activeFocus ? `focus=${orch.activeFocus.type}:${orch.activeFocus.id}` : "",
    orch.clarification?.pending ? "clarification=pending" : "",
    orch.clarification?.abandoned ? "clarification=abandoned" : "",
    `recs=${orch.recommendationQueue?.length ?? 0}`,
    orch.lastConfirmedActionId ? `lastConfirmed=${orch.lastConfirmedActionId}` : "",
    orch.orchestrationSessionId ? `session=${orch.orchestrationSessionId.slice(0, 8)}` : "",
  ].filter(Boolean);
  return parts.join("; ") || "orch=empty";
}

export function buildOrchestrationReplaySnapshot(input: {
  readonly before: RequirementsIntentOrchestrationV1 | null | undefined;
  readonly after: RequirementsIntentOrchestrationV1;
  readonly triggerMessage: string;
  readonly triggerAction?: QuickActionId | null;
  readonly decisionSource?: string;
  readonly agentRole?: string;
  readonly actorId?: string;
  readonly nowIso?: string;
}): OrchestrationReplaySnapshot {
  return {
    beforeStateSummary: summarizeOrchestrationState(input.before),
    afterStateSummary: summarizeOrchestrationState(input.after),
    triggerMessage: input.triggerMessage.slice(0, 200),
    triggerAction: input.triggerAction ?? null,
    at: input.nowIso ?? new Date().toISOString(),
    decisionSource: input.decisionSource ?? "intent-router",
    agentRole: input.agentRole ?? "orchestration-planner",
    actorId: input.actorId ?? "system",
  };
}

export function replaySnapshotTimelineDetail(snapshot: OrchestrationReplaySnapshot): string {
  return [
    "orchestrationGroup:Dispatch",
    `beforeStateSummary:${snapshot.beforeStateSummary}`,
    `afterStateSummary:${snapshot.afterStateSummary}`,
    snapshot.triggerAction ? `triggerAction:${snapshot.triggerAction}` : "",
    snapshot.triggerMessage ? `triggerMessage:${snapshot.triggerMessage.slice(0, 120)}` : "",
    snapshot.decisionSource ? `decisionSource:${snapshot.decisionSource}` : "",
    snapshot.agentRole ? `agentRole:${snapshot.agentRole}` : "",
    snapshot.actorId ? `actorId:${snapshot.actorId}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
