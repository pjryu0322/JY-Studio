import { describe, expect, it } from "vitest";
import { buildStage5ReadyChainInput } from "@/lib/agents/stage5KnowledgeFoundationInput";
import {
  buildDefaultRoleKnowledgePackMappingCandidates,
  evaluateRoleKnowledgePackMappingCandidate,
  resolveRoleKnowledgePackMappingCandidateDecision,
} from "@/lib/agents/evaluateRoleKnowledgePackMappingCandidate";
import { listDefaultRoleKnowledgeAgentTypes } from "@/lib/agents/defaultRoleKnowledgeBindings";

function evaluateReadyMapping(input: Parameters<typeof evaluateRoleKnowledgePackMappingCandidate>[0] = {}) {
  return evaluateRoleKnowledgePackMappingCandidate({
    ...buildStage5ReadyChainInput(),
    ...input,
  });
}

describe("multi-agent role knowledge pack mapping candidate stage 5-C", () => {
  it("default mapping candidates cover all default agent types", () => {
    const report = evaluateReadyMapping();
    expect(report.mappingCandidateCount).toBe(listDefaultRoleKnowledgeAgentTypes().length);
  });

  it("default with upstream ready yields ready_for_mapping_design", () => {
    expect(evaluateReadyMapping().decision).toBe("ready_for_mapping_design");
  });

  it("source Stage 5-B blocked propagates blocked", () => {
    expect(
      evaluateRoleKnowledgePackMappingCandidate({
        stage5AClosure: { agentTypes: ["unknown_role"] },
      }).decision,
    ).toBe("blocked");
  });

  it("unknown agentType yields blocked", () => {
    expect(evaluateReadyMapping({ agentTypes: ["unknown_role"] }).decision).toBe("blocked");
  });

  it("unknown knowledge pack id in mapping yields defer", () => {
    const mappings = buildDefaultRoleKnowledgePackMappingCandidates().map((m) =>
      m.agentType === "planner"
        ? { ...m, requiredKnowledgePackIds: ["kp.platform.nonexistent-pack"] }
        : m,
    );
    expect(evaluateReadyMapping({ mappingCandidates: mappings }).decision).toBe("defer");
  });

  it("unmapped agent yields defer", () => {
    const mappings = buildDefaultRoleKnowledgePackMappingCandidates().filter((m) => m.agentType !== "planner");
    expect(evaluateReadyMapping({ mappingCandidates: mappings }).decision).toBe("defer");
  });

  it("mappingCandidateOnly is true", () => {
    expect(evaluateReadyMapping().mappingCandidateOnly).toBe(true);
  });

  it("actualRoleKnowledgePackMappingWireAllowedInThisStep is false", () => {
    expect(evaluateReadyMapping().actualRoleKnowledgePackMappingWireAllowedInThisStep).toBe(false);
  });

  it("actualPromptInjectionAllowedInThisStep is false", () => {
    expect(evaluateReadyMapping().actualPromptInjectionAllowedInThisStep).toBe(false);
  });

  it("actualRuntimeBindingAllowedInThisStep is false", () => {
    expect(evaluateReadyMapping().actualRuntimeBindingAllowedInThisStep).toBe(false);
  });

  it("mappedAgentCount is positive when ready", () => {
    expect(evaluateReadyMapping().mappedAgentCount).toBeGreaterThan(0);
  });

  it("findings include stage5_c_mapping_ready when ready", () => {
    expect(evaluateReadyMapping().findings.some((f) => f.code === "stage5_c_mapping_ready")).toBe(true);
  });

  it("checklist satisfied for source Stage 5-B ready", () => {
    const item = evaluateReadyMapping().checklist.find((c) => c.item.includes("Stage 5-B"));
    expect(item?.satisfied).toBe(true);
  });

  it("mapping candidates sorted by agentType", () => {
    const types = evaluateReadyMapping().mappingCandidates.map((m) => m.agentType);
    expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b)));
  });

  it("resolveRoleKnowledgePackMappingCandidateDecision blocks on unknown agent", () => {
    expect(
      resolveRoleKnowledgePackMappingCandidateDecision({
        sourceStage5BDecision: "ready_for_metadata_registry_design",
        hasUnknownAgent: true,
        hasUnmappedAgent: false,
        hasUnknownPackInMetadata: false,
      }),
    ).toBe("blocked");
  });

  it("mode and stage are read-only stage 5-C", () => {
    const report = evaluateReadyMapping();
    expect(report.mode).toBe("read_only_role_knowledge_pack_mapping_candidate");
    expect(report.stage).toBe("stage_5_c_candidate");
  });

  it("default mappings include required packs for developer", () => {
    const dev = evaluateReadyMapping().mappingCandidates.find((m) => m.agentType === "developer");
    expect(dev?.requiredKnowledgePackIds.length).toBeGreaterThan(0);
  });

  it("unknownKnowledgePackIdsInMappings reported when pack missing from metadata", () => {
    const mappings = buildDefaultRoleKnowledgePackMappingCandidates().map((m) =>
      m.agentType === "security"
        ? { ...m, optionalKnowledgePackIds: ["kp.unknown.for.test"] }
        : m,
    );
    expect(evaluateReadyMapping({ mappingCandidates: mappings }).unknownKnowledgePackIdsInMappings).toContain(
      "kp.unknown.for.test",
    );
  });

  it("source Stage 5-B defer propagates defer", () => {
    expect(
      evaluateRoleKnowledgePackMappingCandidate({
        stage5AClosure: { stage5AClosureReviewConfirmed: false },
      }).decision,
    ).toBe("defer");
  });

  it("findings include stage5_c_mapping_candidate_only", () => {
    expect(
      evaluateReadyMapping().findings.some((f) => f.code === "stage5_c_mapping_candidate_only"),
    ).toBe(true);
  });
});
