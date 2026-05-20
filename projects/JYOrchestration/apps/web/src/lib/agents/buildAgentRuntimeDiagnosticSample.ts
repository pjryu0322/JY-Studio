/**
 * Sample diagnostic VM for internal preview and tests (dry-run only).
 */

import { planAgentHarnessDryRun } from "@/lib/agents/agentHarnessDryRun";
import { buildAgentRuntimeDiagnosticViewModel } from "@/lib/agents/buildAgentRuntimeDiagnosticViewModel";
import type { AgentRuntimeDiagnosticViewModel } from "@/lib/agents/agentRuntimeDiagnosticViewTypes";
import {
  attachPassThroughSummaryToPersistenceCandidate,
  buildConnectorPassThroughRecordFromHarness,
} from "@/lib/agents/connectorPassThroughPersistenceCandidate";
import { buildTimelineMetadataCandidateFromHarness } from "@/lib/agents/agentRuntimeTimelineReplayCandidate";

/** Builds a representative read-only diagnostic VM without dispatch or external calls. */
export function buildAgentRuntimeDiagnosticSampleViewModel(): AgentRuntimeDiagnosticViewModel {
  const harnessResult = planAgentHarnessDryRun({
    intent: "prototype_build",
    source: "diagnostic",
  });

  const persistenceBase = buildTimelineMetadataCandidateFromHarness(harnessResult);
  const passThroughRecord = buildConnectorPassThroughRecordFromHarness({
    boundaryId: "cursor.execution.before",
    harnessResult,
  });
  const persistenceCandidate = attachPassThroughSummaryToPersistenceCandidate({
    candidate: persistenceBase,
    records: [passThroughRecord],
  });

  return buildAgentRuntimeDiagnosticViewModel({
    harnessResult,
    persistenceCandidate,
    passThroughRecords: [passThroughRecord],
    routingBoundaryId: "cursor.execution.before",
  });
}
