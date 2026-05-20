import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  AGENT_RUNTIME_REGISTRY_VERSION,
  type AgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import { buildAgentRuntimePersistenceCandidateFromHarness } from "@/lib/agents/buildAgentRuntimePersistenceCandidate";
import { evaluateTimelineReplayPersistDesign } from "@/lib/agents/evaluateTimelineReplayPersistDesign";
import { planAgentHarnessDryRun } from "@/lib/agents/agentHarnessDryRun";
import {
  buildReplaySnapshotCandidateFromHarness,
  buildTimelineMetadataCandidateFromHarness,
} from "@/lib/agents/agentRuntimeTimelineReplayCandidate";
import * as timelineReplayModule from "@/lib/agents/agentRuntimeTimelineReplayCandidate";

describe("multi-agent timeline replay persist design stage 2-11", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("valid timeline_metadata candidate returns ready_for_schema_design", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    expect(report.mode).toBe("read_only_persist_design");
    expect(report.decision).toBe("ready_for_schema_design");
    expect(report.target).toBe("timeline_metadata");
  });

  it("valid diagnostic_metadata candidate returns ready_for_schema_design", () => {
    const candidate: AgentRuntimePersistenceCandidate = {
      schemaVersion: AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
      registryVersion: AGENT_RUNTIME_REGISTRY_VERSION,
      kind: "diagnostic_metadata",
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
      createdAt: new Date().toISOString(),
    };
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    expect(report.decision).toBe("ready_for_schema_design");
    expect(report.target).toBe("diagnostic_log");
  });

  it("valid replay_snapshot candidate returns defer", () => {
    const harness = planAgentHarnessDryRun({ intent: "prototype_build" });
    const candidate = buildReplaySnapshotCandidateFromHarness(harness);
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    expect(report.decision).toBe("defer");
    expect(report.target).toBe("replay_snapshot");
  });

  it("invalid candidate returns blocked", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate: AgentRuntimePersistenceCandidate = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      agentId: 123 as unknown as string,
    };
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    expect(report.decision).toBe("blocked");
  });

  it("invalid candidate has at least one blocking finding", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate: AgentRuntimePersistenceCandidate = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      capabilityId: 999 as unknown as string,
    };
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    expect(report.findings.some((f) => f.severity === "blocking")).toBe(true);
    expect(report.findings.some((f) => f.code === "invalid_candidate")).toBe(true);
  });

  it("target_kind_mismatch warning when explicit target differs from kind", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const report = evaluateTimelineReplayPersistDesign({
      candidate,
      target: "replay_snapshot",
    });
    expect(report.findings.some((f) => f.code === "target_kind_mismatch")).toBe(true);
  });

  it("explicit replay_snapshot target yields defer for valid timeline candidate", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const report = evaluateTimelineReplayPersistDesign({
      candidate,
      target: "replay_snapshot",
    });
    expect(report.decision).toBe("defer");
    expect(report.target).toBe("replay_snapshot");
  });

  it("deduplicates excludedFields by field name", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate: AgentRuntimePersistenceCandidate = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      apiKey: "should-not-persist",
    };
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    const apiKeyRows = report.excludedFields.filter((f) => f.field.toLowerCase() === "apikey");
    expect(apiKeyRows.length).toBe(1);
    expect(apiKeyRows[0]?.reason).toContain("detected forbidden");
  });

  it("policy and detected forbidden paths do not duplicate token field row", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate: AgentRuntimePersistenceCandidate = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      nested: { accessToken: "secret" },
    } as AgentRuntimePersistenceCandidate & { nested: { accessToken: string } };
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    const tokenRows = report.excludedFields.filter((f) => f.field.toLowerCase() === "token");
    expect(tokenRows.length).toBe(1);
  });

  it("invalid schemaVersion returns blocked", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate: AgentRuntimePersistenceCandidate = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      schemaVersion: "wrong" as typeof AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
    };
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    expect(report.decision).toBe("blocked");
    expect(report.findings.some((f) => f.code === "invalid_schema_version")).toBe(true);
  });

  it("requiresSchemaChange is true", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const report = evaluateTimelineReplayPersistDesign({
      candidate: buildTimelineMetadataCandidateFromHarness(harness),
    });
    expect(report.requiresSchemaChange).toBe(true);
  });

  it("requiresMigration is true", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const report = evaluateTimelineReplayPersistDesign({
      candidate: buildTimelineMetadataCandidateFromHarness(harness),
    });
    expect(report.requiresMigration).toBe(true);
  });

  it("requiresRollbackPlan is true", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const report = evaluateTimelineReplayPersistDesign({
      candidate: buildTimelineMetadataCandidateFromHarness(harness),
    });
    expect(report.requiresRollbackPlan).toBe(true);
  });

  it("includes agentId capabilityId and summaries in persistFields", () => {
    const harness = planAgentHarnessDryRun({ intent: "prototype_build" });
    const candidate = buildAgentRuntimePersistenceCandidateFromHarness({ result: harness });
    const report = evaluateTimelineReplayPersistDesign({ candidate });
    const fields = report.persistFields.map((f) => f.field);
    expect(fields).toContain("agentId");
    expect(fields).toContain("capabilityId");
    expect(fields).toContain("connectorPlanSummary");
    expect(fields).toContain("governanceSummary");
  });

  it("policy forbidden fields are in excludedFields", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const report = evaluateTimelineReplayPersistDesign({
      candidate: buildTimelineMetadataCandidateFromHarness(harness),
    });
    const forbidden = report.excludedFields.filter((f) => f.sensitivity === "forbidden");
    const names = forbidden.map((f) => f.field.toLowerCase());
    expect(names.some((n) => n.includes("rawprompt") || n === "rawprompt")).toBe(true);
    expect(names.some((n) => n.includes("codediff") || n === "codediff")).toBe(true);
    expect(names.some((n) => n.includes("token"))).toBe(true);
    expect(names.some((n) => n.includes("apikey") || n === "apikey")).toBe(true);
  });

  it("evaluator does not call timeline/replay builder after candidate is built", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const timelineSpy = vi.spyOn(timelineReplayModule, "buildTimelineMetadataCandidateFromHarness");
    const replaySpy = vi.spyOn(timelineReplayModule, "buildReplaySnapshotCandidateFromHarness");
    evaluateTimelineReplayPersistDesign({ candidate });
    expect(timelineSpy).not.toHaveBeenCalled();
    expect(replaySpy).not.toHaveBeenCalled();
  });
});
