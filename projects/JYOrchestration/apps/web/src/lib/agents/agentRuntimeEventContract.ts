/**
 * Runtime event contract — metadata for Timeline/Replay/Governance (persist wire in Stage 2).
 */

import type { AgentRuntimeMode, AgentType } from "@/lib/agents/agentDefinitionTypes";

export type AgentRuntimeEventSource =
  | "single_chat"
  | "requirements"
  | "runtime"
  | "governance"
  | "replay"
  | "connector";

export interface AgentRuntimeEventContext {
  readonly agentId: string;
  readonly capabilityId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly projectId?: string;
  readonly conversationId?: string;
  readonly source?: AgentRuntimeEventSource;
}

export interface AgentTimelineMetadata {
  readonly agentId: string;
  readonly capabilityId?: string;
  readonly agentType?: AgentType;
  readonly runtimeMode?: AgentRuntimeMode;
  readonly actorId?: string;
  readonly agentRole?: string;
  readonly decisionSource?: string;
  readonly connectorId?: string;
}

export interface AgentReplaySnapshotContract {
  readonly agentId: string;
  readonly capabilityId?: string;
  readonly inputContextKeys: readonly string[];
  readonly outputType?: string;
  readonly connectorRefs?: readonly string[];
}

/** @deprecated Use AgentReplaySnapshotContract — kept for Stage 1 bridge alias. */
export type AgentReplayExtension = Readonly<{
  readonly agentId: string;
  readonly capabilityId?: string;
  readonly inputSnapshot?: string;
  readonly outputSnapshot?: string;
}>;

export function toAgentReplayExtension(
  contract: AgentReplaySnapshotContract,
): AgentReplayExtension {
  return {
    agentId: contract.agentId,
    capabilityId: contract.capabilityId,
    inputSnapshot: contract.inputContextKeys.join(","),
    outputSnapshot: contract.outputType,
  };
}
