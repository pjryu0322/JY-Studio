/**
 * Timeline/Replay persistence candidates from harness dry-run (no storage calls).
 */

import { buildAgentRuntimePersistenceCandidateFromHarness } from "@/lib/agents/buildAgentRuntimePersistenceCandidate";
import type { HarnessDryRunResult } from "@/lib/agents/agentHarnessDryRunTypes";
import type { AgentRuntimePersistenceCandidate } from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import {
  sanitizeAgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateValidation";

export function buildTimelineMetadataCandidateFromHarness(
  result: HarnessDryRunResult,
): AgentRuntimePersistenceCandidate {
  return sanitizeAgentRuntimePersistenceCandidate(
    buildAgentRuntimePersistenceCandidateFromHarness({
      result,
      kind: "timeline_metadata",
    }),
  );
}

export function buildReplaySnapshotCandidateFromHarness(
  result: HarnessDryRunResult,
): AgentRuntimePersistenceCandidate {
  return sanitizeAgentRuntimePersistenceCandidate(
    buildAgentRuntimePersistenceCandidateFromHarness({
      result,
      kind: "replay_snapshot",
    }),
  );
}
