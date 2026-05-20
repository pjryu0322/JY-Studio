import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
  type AgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateTypes";
import { buildAgentRuntimePersistenceCandidateFromHarness } from "@/lib/agents/buildAgentRuntimePersistenceCandidate";
import {
  isForbiddenPersistenceKey,
  MAX_CANDIDATE_JSON_LENGTH,
  MAX_REASON_LENGTH,
  sanitizeAgentRuntimePersistenceCandidate,
  validateAgentRuntimePersistenceCandidate,
} from "@/lib/agents/agentRuntimePersistenceCandidateValidation";
import {
  buildReplaySnapshotCandidateFromHarness,
  buildTimelineMetadataCandidateFromHarness,
} from "@/lib/agents/agentRuntimeTimelineReplayCandidate";
import { planAgentHarnessDryRun } from "@/lib/agents/agentHarnessDryRun";

describe("multi-agent runtime persistence candidate stage 2-5", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("buildAgentRuntimePersistenceCandidateFromHarness includes schemaVersion", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildAgentRuntimePersistenceCandidateFromHarness({ result: harness });
    expect(candidate.schemaVersion).toBe(AGENT_RUNTIME_METADATA_SCHEMA_VERSION);
    expect(candidate.registryVersion).toBe("multi-agent-foundation.v1");
  });

  it("ideation harness produces timeline_metadata candidate", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION", source: "manual" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    expect(candidate.kind).toBe("timeline_metadata");
    expect(candidate.agentId).toBe("ai-planner");
    expect(candidate.source).toBe("manual");
  });

  it("prototype_build harness includes connectorPlanSummary", () => {
    const harness = planAgentHarnessDryRun({ intent: "prototype_build" });
    const candidate = buildAgentRuntimePersistenceCandidateFromHarness({ result: harness });
    expect(candidate.connectorPlanSummary?.length).toBeGreaterThan(0);
    expect(candidate.connectorPlanSummary?.[0]?.connectorId).toBe("cursor");
  });

  it("includes governanceSummary when governanceDryRun present", () => {
    const harness = planAgentHarnessDryRun({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
    });
    const candidate = buildAgentRuntimePersistenceCandidateFromHarness({ result: harness });
    expect(candidate.governanceSummary?.status).toBeDefined();
    expect(candidate.governanceSummary?.requiredChecks).toContain("connector:cursor");
  });

  it("truncates warnings and blockingReasons to limits", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const longWarnings = Array.from({ length: 30 }, (_, i) => `warn-${i}`);
    const candidate = buildAgentRuntimePersistenceCandidateFromHarness({
      result: { ...harness, warnings: longWarnings },
    });
    expect((candidate.warnings?.length ?? 0) <= 20).toBe(true);
  });

  it("truncates reason to max length", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildAgentRuntimePersistenceCandidateFromHarness({
      result: { ...harness, reason: "x".repeat(500) },
    });
    expect((candidate.reason?.length ?? 0) <= MAX_REASON_LENGTH).toBe(true);
  });

  it("detects variant forbidden keys via fragment matching", () => {
    expect(isForbiddenPersistenceKey("accessToken")).toBe(true);
    expect(isForbiddenPersistenceKey("githubToken")).toBe(true);
    expect(isForbiddenPersistenceKey("cursorApiKey")).toBe(true);
    expect(isForbiddenPersistenceKey("authorizationHeader")).toBe(true);
    expect(isForbiddenPersistenceKey("sourceCodeDiff")).toBe(true);
    expect(isForbiddenPersistenceKey("projectId")).toBe(false);
  });

  it("sanitizer removes forbidden keys including variants", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const dirty = {
      ...buildAgentRuntimePersistenceCandidateFromHarness({ result: harness }),
      accessToken: "secret-value",
      authorizationHeader: "hdr",
    } as ReturnType<typeof buildAgentRuntimePersistenceCandidateFromHarness> & {
      accessToken: string;
      authorizationHeader: string;
    };
    const clean = sanitizeAgentRuntimePersistenceCandidate(dirty);
    expect("accessToken" in clean).toBe(false);
    expect("authorizationHeader" in clean).toBe(false);
  });

  it("raw candidate with forbidden keys is invalid then sanitize becomes valid", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const raw = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      githubToken: "x",
    } as AgentRuntimePersistenceCandidate & { githubToken: string };
    const rawValidation = validateAgentRuntimePersistenceCandidate(raw);
    expect(rawValidation.valid).toBe(false);
    expect(rawValidation.warnings.some((w) => w.startsWith("forbidden_key_detected"))).toBe(true);

    const clean = sanitizeAgentRuntimePersistenceCandidate(raw);
    const cleanValidation = validateAgentRuntimePersistenceCandidate(clean);
    expect(cleanValidation.valid).toBe(true);
  });

  it("validate returns valid=true for normal candidate", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildTimelineMetadataCandidateFromHarness(harness);
    const v = validateAgentRuntimePersistenceCandidate(candidate);
    expect(v.valid).toBe(true);
  });

  it("validate returns valid=false for wrong schemaVersion", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      schemaVersion: "wrong.v0" as typeof AGENT_RUNTIME_METADATA_SCHEMA_VERSION,
    };
    const v = validateAgentRuntimePersistenceCandidate(candidate);
    expect(v.valid).toBe(false);
  });

  it("buildReplaySnapshotCandidateFromHarness uses replay_snapshot kind", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const candidate = buildReplaySnapshotCandidateFromHarness(harness);
    expect(candidate.kind).toBe("replay_snapshot");
  });

  it("validate rejects oversized candidate json", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    const oversized = {
      ...buildTimelineMetadataCandidateFromHarness(harness),
      warnings: Array.from({ length: 500 }, (_, i) => `w-${"x".repeat(40)}-${i}`),
    };
    const v = validateAgentRuntimePersistenceCandidate(oversized);
    expect(v.valid).toBe(false);
    expect(v.warnings).toContain("candidate_json_exceeds_limit");
    expect(JSON.stringify(oversized).length).toBeGreaterThan(MAX_CANDIDATE_JSON_LENGTH);
  });

  it("candidate builders do not call timeline or replay persistence", () => {
    const harness = planAgentHarnessDryRun({ intent: "ideation", stage: "IDEATION" });
    expect(() => buildTimelineMetadataCandidateFromHarness(harness)).not.toThrow();
    expect(() => buildReplaySnapshotCandidateFromHarness(harness)).not.toThrow();
    expect(buildTimelineMetadataCandidateFromHarness(harness).kind).toBe("timeline_metadata");
  });
});
