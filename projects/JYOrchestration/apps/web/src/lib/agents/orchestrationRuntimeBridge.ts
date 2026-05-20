/**
 * Bridge notes: Requirements governed runtime ↔ Agent Foundation (Stage 1 — types only).
 */

import type { OrchestrationReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplay";

/** Timeline fields already present; future Harness should populate explicitly. */
export type AgentTimelineMetadata = Readonly<{
  readonly agentId?: string;
  readonly agentRole?: string;
  readonly actorId?: string;
  readonly decisionSource?: string;
  readonly capabilityId?: string;
  readonly connectorId?: string;
}>;

export function agentTimelineMetadataFromReplay(snapshot: OrchestrationReplaySnapshot): AgentTimelineMetadata {
  return {
    actorId: snapshot.actorId,
    agentRole: snapshot.agentRole,
    decisionSource: snapshot.decisionSource,
  };
}

/** Suggested replay extension (not persisted in Stage 1). */
export type AgentReplayExtension = Readonly<{
  readonly agentId: string;
  readonly capabilityId?: string;
  readonly inputSnapshot?: string;
  readonly outputSnapshot?: string;
}>;
