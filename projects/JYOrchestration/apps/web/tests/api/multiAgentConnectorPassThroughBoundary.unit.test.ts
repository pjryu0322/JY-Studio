import { afterEach, describe, expect, it, vi } from "vitest";
import * as connectorFacade from "@/lib/agents/connectorGatewayFacade";
import { buildConnectorPassThroughRecordCandidate } from "@/lib/agents/buildConnectorPassThroughRecordCandidate";
import {
  attachPassThroughSummaryToPersistenceCandidate,
  buildConnectorPassThroughRecordFromHarness,
} from "@/lib/agents/connectorPassThroughPersistenceCandidate";
import { CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION } from "@/lib/agents/connectorPassThroughBoundaryTypes";
import {
  getConnectorPassThroughBoundaryById,
  listConnectorPassThroughBoundaries,
} from "@/lib/agents/connectorPassThroughBoundaryRegistry";
import { buildTimelineMetadataCandidateFromHarness } from "@/lib/agents/agentRuntimeTimelineReplayCandidate";
import { planAgentHarnessDryRun } from "@/lib/agents/agentHarnessDryRun";

describe("multi-agent connector pass-through boundary stage 2-6", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listConnectorPassThroughBoundaries returns default boundaries", () => {
    const boundaries = listConnectorPassThroughBoundaries();
    expect(boundaries.length).toBeGreaterThanOrEqual(4);
    expect(boundaries.some((b) => b.id === "cursor.execution.before")).toBe(true);
  });

  it("cursor.execution.before has connectorId cursor", () => {
    const b = getConnectorPassThroughBoundaryById("cursor.execution.before");
    expect(b?.connectorId).toBe("cursor");
  });

  it("github.pr.create.before has connectorId github", () => {
    const b = getConnectorPassThroughBoundaryById("github.pr.create.before");
    expect(b?.connectorId).toBe("github");
  });

  it("buildConnectorPassThroughRecordCandidate returns pass_through mode and recordOnly", () => {
    const record = buildConnectorPassThroughRecordCandidate({
      boundaryId: "cursor.execution.before",
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(record.schemaVersion).toBe(CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION);
    expect(record.mode).toBe("pass_through");
    expect(record.recordOnly).toBe(true);
  });

  it("unknown boundaryId returns allowed=false", () => {
    const record = buildConnectorPassThroughRecordCandidate({
      boundaryId: "nonexistent.boundary",
    });
    expect(record.allowed).toBe(false);
    expect(record.reason).toContain("boundary_not_found");
  });

  it("pass-through record uses facade only without external invocation", () => {
    const planSpy = vi.spyOn(connectorFacade, "planConnectorInvocation");
    buildConnectorPassThroughRecordCandidate({
      boundaryId: "cursor.execution.before",
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(planSpy).toHaveBeenCalled();
    expect(planSpy.mock.calls[0]?.[0]?.mode).toBe("pass_through");
  });

  it("ai-developer + cursor boundary can be allowed", () => {
    const record = buildConnectorPassThroughRecordCandidate({
      boundaryId: "cursor.execution.before",
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    expect(record.allowed).toBe(true);
  });

  it("ai-planner + cursor boundary is not allowed", () => {
    const record = buildConnectorPassThroughRecordCandidate({
      boundaryId: "cursor.execution.before",
      agentId: "ai-planner",
      capabilityId: "project.idea.structure",
    });
    expect(record.allowed).toBe(false);
  });

  it("buildConnectorPassThroughRecordFromHarness reflects harness agent and capability", () => {
    const harness = planAgentHarnessDryRun({
      agentId: "ai-scm",
      capabilityId: "git.pr.merge.control",
      projectId: "p1",
      source: "requirements",
    });
    const record = buildConnectorPassThroughRecordFromHarness({
      boundaryId: "github.pr.create.before",
      harnessResult: harness,
    });
    expect(record.agentId).toBe("ai-scm");
    expect(record.capabilityId).toBe("git.pr.merge.control");
  });

  it("attachPassThroughSummaryToPersistenceCandidate attaches summary only", () => {
    const harness = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    const base = buildTimelineMetadataCandidateFromHarness(harness);
    const record = buildConnectorPassThroughRecordFromHarness({
      boundaryId: "cursor.execution.before",
      harnessResult: harness,
    });
    const attached = attachPassThroughSummaryToPersistenceCandidate({
      candidate: base,
      records: [record],
    });
    expect(attached.passThroughRecordSummary?.length).toBe(1);
    expect(attached.passThroughRecordSummary?.[0]?.boundaryId).toBe("cursor.execution.before");
    expect(record.schemaVersion).toBe(CONNECTOR_PASS_THROUGH_RECORD_SCHEMA_VERSION);
    expect(Object.keys(attached.passThroughRecordSummary?.[0] ?? {})).toEqual([
      "boundaryId",
      "connectorId",
      "operation",
      "allowed",
      "reason",
    ]);
  });

  it("passThrough summary respects count limit", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const base = buildTimelineMetadataCandidateFromHarness(harness);
    const records = Array.from({ length: 15 }, (_, i) =>
      buildConnectorPassThroughRecordCandidate({
        boundaryId: "cursor.execution.before",
        agentId: `agent-${i}`,
      }),
    );
    const attached = attachPassThroughSummaryToPersistenceCandidate({
      candidate: base,
      records,
    });
    expect((attached.passThroughRecordSummary?.length ?? 0) <= 10).toBe(true);
  });
});
