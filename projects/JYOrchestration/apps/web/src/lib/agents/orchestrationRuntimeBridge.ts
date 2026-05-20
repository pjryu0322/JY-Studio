/**
 * Requirements governed runtime ↔ Agent Foundation event metadata helpers.
 */

import type { OrchestrationReplaySnapshot } from "@/lib/requirements/requirementsOrchestrationReplay";
import { getAgentById } from "@/lib/agents/agentRegistry";
import {
  resolveAgentIdFromRuntimeRole,
} from "@/lib/agents/aiMemberAgentBridge";
import type {
  AgentReplayExtension,
  AgentReplaySnapshotContract,
  AgentRuntimeEventContext,
  AgentTimelineMetadata,
} from "@/lib/agents/agentRuntimeEventContract";

export type {
  AgentReplayExtension,
  AgentReplaySnapshotContract,
  AgentRuntimeEventContext,
  AgentRuntimeEventSource,
  AgentTimelineMetadata,
} from "@/lib/agents/agentRuntimeEventContract";

export function buildAgentRuntimeEventContext(input: {
  readonly agentId: string;
  readonly capabilityId?: string;
  readonly projectId?: string;
  readonly source?: AgentRuntimeEventContext["source"];
}): AgentRuntimeEventContext {
  return {
    agentId: input.agentId,
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.source ? { source: input.source } : {}),
  };
}

export function agentTimelineMetadataFromReplay(
  snapshot: OrchestrationReplaySnapshot,
  input?: { readonly capabilityId?: string; readonly agentId?: string },
): AgentTimelineMetadata {
  const agentId =
    input?.agentId ??
    resolveAgentIdFromRuntimeRole(snapshot.agentRole) ??
    "system";
  const agent = getAgentById(agentId);
  return {
    agentId,
    ...(input?.capabilityId ? { capabilityId: input.capabilityId } : {}),
    ...(agent ? { agentType: agent.type, runtimeMode: agent.runtimeMode } : {}),
    actorId: snapshot.actorId,
    agentRole: snapshot.agentRole,
    decisionSource: snapshot.decisionSource,
  };
}

export function agentReplayContractFromFoundation(input: {
  readonly agentId: string;
  readonly capabilityId?: string;
  readonly inputContextKeys?: readonly string[];
  readonly outputType?: string;
  readonly connectorRefs?: readonly string[];
}): AgentReplaySnapshotContract {
  return {
    agentId: input.agentId,
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    inputContextKeys: input.inputContextKeys ?? [],
    ...(input.outputType ? { outputType: input.outputType } : {}),
    ...(input.connectorRefs?.length ? { connectorRefs: input.connectorRefs } : {}),
  };
}
