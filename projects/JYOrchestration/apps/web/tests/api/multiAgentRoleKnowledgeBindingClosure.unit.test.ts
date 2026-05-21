import { describe, expect, it } from "vitest";
import {
  buildRoleKnowledgeBindingClosureFingerprint,
  evaluateRoleKnowledgeBindingClosure,
  resolveRoleKnowledgeBindingClosureDecision,
} from "@/lib/agents/evaluateRoleKnowledgeBindingClosure";
import {
  listDefaultKnowledgePackIds,
  listDefaultRoleKnowledgeAgentTypes,
} from "@/lib/agents/defaultRoleKnowledgeBindings";

const ALL_CLOSURE_CONFIRMATIONS = {
  stage5AClosureReviewConfirmed: true,
  stage5ANotKnowledgePackImplementationConfirmed: true,
  stage5ANoRagConfirmed: true,
  stage5ANoPromptInjectionConfirmed: true,
  stage5ANoRuntimeDbUiConfirmed: true,
} as const;

function evaluateReadyClosure(input: Parameters<typeof evaluateRoleKnowledgeBindingClosure>[0] = {}) {
  return evaluateRoleKnowledgeBindingClosure({
    ...ALL_CLOSURE_CONFIRMATIONS,
    ...input,
  });
}

describe("multi-agent role knowledge binding closure stage 5-A", () => {
  it("default input uses all default knowledge pack ids", () => {
    const report = evaluateReadyClosure();
    const defaultIds = [...listDefaultKnowledgePackIds()].sort((a, b) => a.localeCompare(b));
    expect(report.sourceDefaultKnowledgePackIds).toEqual(defaultIds);
    expect(report.sourceDefaultKnowledgePackIdCount).toBe(defaultIds.length);
  });

  it("default input aggregates all default agent types from binding registry", () => {
    const report = evaluateReadyClosure();
    const expected = listDefaultRoleKnowledgeAgentTypes();
    expect(report.agentCount).toBe(expected.length);
    expect(report.agentSummaries.map((s) => s.agentType)).toEqual(expected);
  });

  it("all confirmations true yields stage5_a_closure_ready", () => {
    expect(evaluateReadyClosure().decision).toBe("stage5_a_closure_ready");
  });

  it("missing closure review confirmation yields defer", () => {
    expect(
      evaluateReadyClosure({ stage5AClosureReviewConfirmed: false }).decision,
    ).toBe("defer");
  });

  it("missing not-implementation confirmation yields defer", () => {
    expect(
      evaluateReadyClosure({ stage5ANotKnowledgePackImplementationConfirmed: false }).decision,
    ).toBe("defer");
  });

  it("missing no-RAG confirmation yields defer", () => {
    expect(evaluateReadyClosure({ stage5ANoRagConfirmed: false }).decision).toBe("defer");
  });

  it("missing no-prompt-injection confirmation yields defer", () => {
    expect(
      evaluateReadyClosure({ stage5ANoPromptInjectionConfirmed: false }).decision,
    ).toBe("defer");
  });

  it("missing no-runtime-db-ui confirmation yields defer", () => {
    expect(evaluateReadyClosure({ stage5ANoRuntimeDbUiConfirmed: false }).decision).toBe("defer");
  });

  it("missing required pack in availableKnowledgePackIds yields defer", () => {
    expect(
      evaluateReadyClosure({ availableKnowledgePackIds: [] }).decision,
    ).toBe("defer");
  });

  it("unknown agentType yields blocked", () => {
    const report = evaluateReadyClosure({ agentTypes: ["unknown_role"] });
    expect(report.decision).toBe("blocked");
    expect(report.blockedAgentCount).toBe(1);
  });

  it("unknown knowledge pack id is reported but does not force blocked when required satisfied", () => {
    const report = evaluateReadyClosure({
      availableKnowledgePackIds: [...listDefaultKnowledgePackIds(), "kp.platform.unknown-pack.test"],
    });
    expect(report.decision).toBe("stage5_a_closure_ready");
    expect(report.findings.some((f) => f.code === "source_unknown_knowledge_pack_id_reported")).toBe(true);
  });

  it("closureFingerprint is deterministic", () => {
    const first = evaluateReadyClosure();
    const second = evaluateReadyClosure();
    expect(first.closureFingerprint).toBe(second.closureFingerprint);
    expect(buildRoleKnowledgeBindingClosureFingerprint({
      agentSummaries: first.agentSummaries,
      sourceDefaultKnowledgePackIdCount: first.sourceDefaultKnowledgePackIdCount,
      ...ALL_CLOSURE_CONFIRMATIONS,
    })).toBe(first.closureFingerprint);
  });

  it("agentSummaries are sorted deterministically by agentType", () => {
    const types = evaluateReadyClosure().agentSummaries.map((s) => s.agentType);
    expect(types).toEqual([...types].sort((a, b) => a.localeCompare(b)));
  });

  it("totalRequiredBindingCount equals sum of source required counts", () => {
    const report = evaluateReadyClosure();
    const sum = report.agentSummaries.reduce((t, s) => t + s.requiredBindingCount, 0);
    expect(report.totalRequiredBindingCount).toBe(sum);
  });

  it("totalSatisfiedRequiredBindingCount equals sum of source satisfied required counts", () => {
    const report = evaluateReadyClosure();
    const sum = report.agentSummaries.reduce((t, s) => t + s.satisfiedRequiredBindingCount, 0);
    expect(report.totalSatisfiedRequiredBindingCount).toBe(sum);
    expect(report.allRequiredBindingsSatisfied).toBe(true);
  });

  it("stage5AClosureIsKnowledgePackImplementation is false", () => {
    expect(evaluateReadyClosure().stage5AClosureIsKnowledgePackImplementation).toBe(false);
  });

  it("stage5AClosureUsesRag is false", () => {
    expect(evaluateReadyClosure().stage5AClosureUsesRag).toBe(false);
  });

  it("stage5AClosureModifiesPromptInjection is false", () => {
    expect(evaluateReadyClosure().stage5AClosureModifiesPromptInjection).toBe(false);
  });

  it("stage5AClosureModifiesRuntime is false", () => {
    expect(evaluateReadyClosure().stage5AClosureModifiesRuntime).toBe(false);
  });

  it("stage5AClosureModifiesDb is false", () => {
    expect(evaluateReadyClosure().stage5AClosureModifiesDb).toBe(false);
  });

  it("stage5AClosureModifiesUi is false", () => {
    expect(evaluateReadyClosure().stage5AClosureModifiesUi).toBe(false);
  });

  it("stage5BEntryCandidate equals knowledge_pack_metadata_registry_candidate", () => {
    expect(evaluateReadyClosure().stage5BEntryCandidate).toBe("knowledge_pack_metadata_registry_candidate");
  });

  it("stage5BEntryIsCandidateOnly is true", () => {
    expect(evaluateReadyClosure().stage5BEntryIsCandidateOnly).toBe(true);
  });

  it("actualKnowledgePackMetadataRegistryAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualKnowledgePackMetadataRegistryAllowedInThisStep).toBe(false);
  });

  it("actualKnowledgePackCrudAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualKnowledgePackCrudAllowedInThisStep).toBe(false);
  });

  it("actualRagIndexingAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualRagIndexingAllowedInThisStep).toBe(false);
  });

  it("actualPromptInjectionAllowedInThisStep is false", () => {
    expect(evaluateReadyClosure().actualPromptInjectionAllowedInThisStep).toBe(false);
  });

  it("findings include stage5_a_closure_read_only", () => {
    expect(
      evaluateReadyClosure().findings.some((f) => f.code === "stage5_a_closure_read_only"),
    ).toBe(true);
  });

  it("findings include stage5_b_metadata_registry_candidate_only", () => {
    expect(
      evaluateReadyClosure().findings.some((f) => f.code === "stage5_b_metadata_registry_candidate_only"),
    ).toBe(true);
  });

  it("ready finding appears when decision is stage5_a_closure_ready", () => {
    expect(
      evaluateReadyClosure().findings.some((f) => f.code === "stage5_a_closure_ready"),
    ).toBe(true);
  });

  it("defer finding appears when decision is defer", () => {
    expect(
      evaluateReadyClosure({ stage5AClosureReviewConfirmed: false }).findings.some(
        (f) => f.code === "stage5_a_closure_deferred",
      ),
    ).toBe(true);
  });

  it("blocked finding appears when decision is blocked", () => {
    expect(
      evaluateReadyClosure({ agentTypes: ["unknown_role"] }).findings.some(
        (f) => f.code === "stage5_a_closure_blocked",
      ),
    ).toBe(true);
  });

  describe("resolveRoleKnowledgeBindingClosureDecision", () => {
    it("returns blocked when hasBlocked", () => {
      expect(
        resolveRoleKnowledgeBindingClosureDecision({
          hasBlocked: true,
          hasDefer: false,
          allReady: false,
          ...ALL_CLOSURE_CONFIRMATIONS,
        }),
      ).toBe("blocked");
    });
  });
});
