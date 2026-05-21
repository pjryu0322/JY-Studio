import { describe, expect, it } from "vitest";
import { buildStage5AClosureConfirmedInput } from "@/lib/agents/evaluateRoleKnowledgeBindingClosure";
import {
  evaluateKnowledgePackMetadataRegistryCandidate,
  resolveKnowledgePackMetadataRegistryCandidateDecision,
  validateMetadataCandidates,
} from "@/lib/agents/evaluateKnowledgePackMetadataRegistryCandidate";
import { buildDefaultKnowledgePackMetadataCandidates } from "@/lib/agents/defaultKnowledgePackMetadataCandidates";
import type { KnowledgePackMetadataCandidate } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";

function evaluateReadyMetadata(input: Parameters<typeof evaluateKnowledgePackMetadataRegistryCandidate>[0] = {}) {
  return evaluateKnowledgePackMetadataRegistryCandidate({
    stage5AClosure: buildStage5AClosureConfirmedInput(),
    ...input,
  });
}

describe("multi-agent knowledge pack metadata registry candidate stage 5-B", () => {
  it("default candidates are sorted by knowledgePackId", () => {
    const ids = evaluateReadyMetadata().metadataCandidates.map((c) => c.knowledgePackId);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it("default with Stage 5-A ready yields ready_for_metadata_registry_design", () => {
    expect(evaluateReadyMetadata().decision).toBe("ready_for_metadata_registry_design");
  });

  it("source Stage 5-A defer propagates defer", () => {
    expect(
      evaluateKnowledgePackMetadataRegistryCandidate({
        stage5AClosure: { stage5AClosureReviewConfirmed: false },
      }).decision,
    ).toBe("defer");
  });

  it("source Stage 5-A blocked propagates blocked", () => {
    expect(
      evaluateKnowledgePackMetadataRegistryCandidate({
        stage5AClosure: { agentTypes: ["unknown_role"] },
      }).decision,
    ).toBe("blocked");
  });

  it("blank knowledge pack id yields blocked", () => {
    const bad: KnowledgePackMetadataCandidate = {
      ...buildDefaultKnowledgePackMetadataCandidates()[0]!,
      knowledgePackId: "   ",
    };
    expect(evaluateReadyMetadata({ metadataCandidates: [bad] }).decision).toBe("blocked");
  });

  it("invalid category yields blocked", () => {
    const bad = {
      ...buildDefaultKnowledgePackMetadataCandidates()[0]!,
      category: "invalid_category" as KnowledgePackMetadataCandidate["category"],
    };
    expect(evaluateReadyMetadata({ metadataCandidates: [bad] }).decision).toBe("blocked");
  });

  it("missing title yields defer", () => {
    const bad = { ...buildDefaultKnowledgePackMetadataCandidates()[0]!, title: "" };
    expect(evaluateReadyMetadata({ metadataCandidates: [bad] }).decision).toBe("defer");
  });

  it("registryCandidateOnly is true", () => {
    expect(evaluateReadyMetadata().registryCandidateOnly).toBe(true);
  });

  it("actualRegistryImplementationAllowedInThisStep is false", () => {
    expect(evaluateReadyMetadata().actualRegistryImplementationAllowedInThisStep).toBe(false);
  });

  it("actualKnowledgePackCrudAllowedInThisStep is false", () => {
    expect(evaluateReadyMetadata().actualKnowledgePackCrudAllowedInThisStep).toBe(false);
  });

  it("actualDbWriteAllowedInThisStep is false", () => {
    expect(evaluateReadyMetadata().actualDbWriteAllowedInThisStep).toBe(false);
  });

  it("actualRagIndexingAllowedInThisStep is false", () => {
    expect(evaluateReadyMetadata().actualRagIndexingAllowedInThisStep).toBe(false);
  });

  it("actualUiAllowedInThisStep is false", () => {
    expect(evaluateReadyMetadata().actualUiAllowedInThisStep).toBe(false);
  });

  it("requiredMetadataFields includes knowledgePackId", () => {
    expect(evaluateReadyMetadata().requiredMetadataFields).toContain("knowledgePackId");
  });

  it("findings include stage5_b_candidate_evaluator_created", () => {
    expect(
      evaluateReadyMetadata().findings.some((f) => f.code === "stage5_b_candidate_evaluator_created"),
    ).toBe(true);
  });

  it("ready findings include stage5_b_candidate_ready", () => {
    expect(evaluateReadyMetadata().findings.some((f) => f.code === "stage5_b_candidate_ready")).toBe(true);
  });

  it("checklist items have non-empty reason", () => {
    expect(evaluateReadyMetadata().checklist.every((c) => c.reason.length > 0)).toBe(true);
  });

  it("candidateCount matches metadataCandidates length", () => {
    const report = evaluateReadyMetadata();
    expect(report.candidateCount).toBe(report.metadataCandidates.length);
  });

  it("resolveKnowledgePackMetadataRegistryCandidateDecision blocked when source blocked", () => {
    expect(
      resolveKnowledgePackMetadataRegistryCandidateDecision({
        sourceStage5AClosureDecision: "blocked",
        hasBlockedCandidate: false,
        hasMissingRequiredFields: false,
      }),
    ).toBe("blocked");
  });

  it("validateMetadataCandidates detects blank ids", () => {
    const validation = validateMetadataCandidates([
      { ...buildDefaultKnowledgePackMetadataCandidates()[0]!, knowledgePackId: "" },
    ]);
    expect(validation.hasBlockedCandidate).toBe(true);
    expect(validation.blankIds.length).toBeGreaterThan(0);
  });

  it("mode and stage are read-only stage 5-B", () => {
    const report = evaluateReadyMetadata();
    expect(report.mode).toBe("read_only_knowledge_pack_metadata_registry_candidate");
    expect(report.stage).toBe("stage_5_b_candidate");
  });
});
