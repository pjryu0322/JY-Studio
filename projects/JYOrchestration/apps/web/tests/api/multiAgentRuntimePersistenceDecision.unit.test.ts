import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  AGENT_RUNTIME_REGISTRY_VERSION,
  type AgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import { evaluateAgentRuntimePersistenceDecision } from "@/lib/agents/evaluateAgentRuntimePersistenceDecision";
import {
  buildReplaySnapshotCandidateFromHarness,
  buildTimelineMetadataCandidateFromHarness,
} from "@/lib/agents/agentRuntimeTimelineReplayCandidate";
import { planAgentHarnessDryRun } from "@/lib/agents/agentHarnessDryRun";
import * as timelineReplayModule from "@/lib/agents/agentRuntimeTimelineReplayCandidate";

describe("multi-agent runtime persistence decision stage 2-8", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("valid timeline_metadata candidate returns ready_for_design", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const report = evaluateAgentRuntimePersistenceDecision({ candidate });
    expect(report.mode).toBe("read_only_decision");
    expect(report.decision).toBe("ready_for_design");
    expect(report.candidateValid).toBe(true);
    expect(report.recommendedTargets).toContain("timeline_metadata");
  });

  it("invalid schemaVersion candidate returns blocked", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate: AgentRuntimePersistenceCandidate = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      schemaVersion: "wrong-version" as typeof AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
    };
    const report = evaluateAgentRuntimePersistenceDecision({ candidate });
    expect(report.decision).toBe("blocked");
    expect(report.candidateValid).toBe(false);
    expect(report.findings.some((f) => f.code === "invalid_schema_version")).toBe(true);
  });

  it("forbidden key candidate returns blocked", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const withForbidden = {
      ...candidate,
      metadata: { accessToken: "secret" },
    } as AgentRuntimePersistenceCandidate & { metadata: { accessToken: string } };
    const report = evaluateAgentRuntimePersistenceDecision({ candidate: withForbidden });
    expect(report.decision).toBe("blocked");
    expect(
      report.findings.some(
        (f) => f.code === "forbidden_key" || f.message.includes("forbidden_key_detected"),
      ),
    ).toBe(true);
  });

  it("replay_snapshot candidate returns defer", () => {
    const harness = planAgentHarnessDryRun({ intent: "prototype_build" });
    const candidate = buildReplaySnapshotCandidateFromHarness(harness);
    const report = evaluateAgentRuntimePersistenceDecision({ candidate });
    expect(report.decision).toBe("defer");
    expect(report.findings.some((f) => f.code === "defer_replay_snapshot")).toBe(true);
  });

  it("diagnostic_metadata candidate recommends diagnostic_log target", () => {
    const harness = planAgentHarnessDryRun({ intent: "prototype_build" });
    const candidate: AgentRuntimePersistenceCandidate = {
      schemaVersion: AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
      registryVersion: AGENT_RUNTIME_REGISTRY_VERSION,
      kind: "diagnostic_metadata",
      agentId: harness.agentId,
      capabilityId: harness.capabilityId,
      governanceSummary: {
        status: "warning_candidate",
        requiredChecks: ["connector:cursor"],
        evaluatedPolicyIds: ["gov-cursor-warning"],
        findingCount: 1,
        warningCount: 1,
        blockingCandidateCount: 0,
      },
    };
    const report = evaluateAgentRuntimePersistenceDecision({ candidate });
    expect(report.recommendedTargets).toContain("diagnostic_log");
    expect(report.decision).toBe("ready_for_design");
  });

  it("report mode is read_only_decision", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const report = evaluateAgentRuntimePersistenceDecision({
      candidate: buildTimelineMetadataCandidateFromHarness(harness),
    });
    expect(report.mode).toBe("read_only_decision");
  });

  it("evaluator does not call timeline/replay builder functions", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const timelineSpy = vi.spyOn(timelineReplayModule, "buildTimelineMetadataCandidateFromHarness");
    const replaySpy = vi.spyOn(timelineReplayModule, "buildReplaySnapshotCandidateFromHarness");
    evaluateAgentRuntimePersistenceDecision({ candidate });
    expect(timelineSpy).not.toHaveBeenCalled();
    expect(replaySpy).not.toHaveBeenCalled();
  });

  it("requiresSchemaChange and requiresMigration are true without actual apply", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const report = evaluateAgentRuntimePersistenceDecision({
      candidate: buildTimelineMetadataCandidateFromHarness(harness),
    });
    expect(report.requiresSchemaChange).toBe(true);
    expect(report.requiresMigration).toBe(true);
  });
});
