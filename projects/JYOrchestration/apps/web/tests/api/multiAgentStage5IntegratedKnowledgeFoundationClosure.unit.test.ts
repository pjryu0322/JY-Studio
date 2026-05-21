import { describe, expect, it } from "vitest";
import {
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  evaluateStage5IntegratedKnowledgeFoundationClosure,
  RECOMMENDED_NEXT_PHASES,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  SEPARATED_WORK_ITEMS,
} from "@/lib/agents/evaluateStage5IntegratedKnowledgeFoundationClosure";

const ALL_STAGE5_READY = {
  stage5AClosure: {
    stage5AClosureReviewConfirmed: true,
    stage5ANotKnowledgePackImplementationConfirmed: true,
    stage5ANoRagConfirmed: true,
    stage5ANoPromptInjectionConfirmed: true,
    stage5ANoRuntimeDbUiConfirmed: true,
  },
} as const;

function evaluateReadyIntegrated(
  input: Parameters<typeof evaluateStage5IntegratedKnowledgeFoundationClosure>[0] = {},
) {
  return evaluateStage5IntegratedKnowledgeFoundationClosure({ ...ALL_STAGE5_READY, ...input });
}

describe("multi-agent stage 5 integrated knowledge foundation closure stage 5-F", () => {
  it("all upstream ready yields stage5_knowledge_foundation_ready", () => {
    expect(evaluateReadyIntegrated().decision).toBe("stage5_knowledge_foundation_ready");
  });

  it("source Stage 5-A blocked propagates blocked", () => {
    expect(
      evaluateStage5IntegratedKnowledgeFoundationClosure({
        stage5AClosure: { agentTypes: ["unknown_role"] },
      }).decision,
    ).toBe("blocked");
  });

  it("source Stage 5-A defer propagates defer", () => {
    expect(
      evaluateStage5IntegratedKnowledgeFoundationClosure({
        stage5AClosure: { stage5AClosureReviewConfirmed: false },
      }).decision,
    ).toBe("defer");
  });

  it("knowledgeFoundationOnly is true", () => {
    expect(evaluateReadyIntegrated().knowledgeFoundationOnly).toBe(true);
  });

  it("actualKnowledgePackImplementationAllowedAfterStage5 is false", () => {
    expect(evaluateReadyIntegrated().actualKnowledgePackImplementationAllowedAfterStage5).toBe(false);
  });

  it("actualKnowledgePackCrudAllowedAfterStage5 is false", () => {
    expect(evaluateReadyIntegrated().actualKnowledgePackCrudAllowedAfterStage5).toBe(false);
  });

  it("actualRagIndexingAllowedAfterStage5 is false", () => {
    expect(evaluateReadyIntegrated().actualRagIndexingAllowedAfterStage5).toBe(false);
  });

  it("actualPromptInjectionAllowedAfterStage5 is false", () => {
    expect(evaluateReadyIntegrated().actualPromptInjectionAllowedAfterStage5).toBe(false);
  });

  it("actualRuntimeExecutionAllowedAfterStage5 is false", () => {
    expect(evaluateReadyIntegrated().actualRuntimeExecutionAllowedAfterStage5).toBe(false);
  });

  it("actualDbMigrationAllowedAfterStage5 is false", () => {
    expect(evaluateReadyIntegrated().actualDbMigrationAllowedAfterStage5).toBe(false);
  });

  it("actualUiImplementationAllowedAfterStage5 is false", () => {
    expect(evaluateReadyIntegrated().actualUiImplementationAllowedAfterStage5).toBe(false);
  });

  it("stage6EntryCandidate is runtime_execution_model_design", () => {
    expect(evaluateReadyIntegrated().stage6EntryCandidate).toBe("runtime_execution_model_design");
  });

  it("stage6EntryIsCandidateOnly is true", () => {
    expect(evaluateReadyIntegrated().stage6EntryIsCandidateOnly).toBe(true);
  });

  it("closureFingerprint is deterministic", () => {
    const a = evaluateReadyIntegrated();
    const b = evaluateReadyIntegrated();
    expect(a.closureFingerprint).toBe(b.closureFingerprint);
    expect(buildStage5IntegratedKnowledgeFoundationClosureFingerprint({
      sourceStage5AClosureDecision: a.sourceStage5AClosureDecision,
      sourceStage5BDecision: a.sourceStage5BDecision,
      sourceStage5CDecision: a.sourceStage5CDecision,
      sourceStage5DDecision: a.sourceStage5DDecision,
    })).toBe(a.closureFingerprint);
  });

  it("closureVersion is stage_5_integrated_knowledge_foundation_closure_v1", () => {
    expect(evaluateReadyIntegrated().closureVersion).toBe("stage_5_integrated_knowledge_foundation_closure_v1");
  });

  it("recommendedNextPhases is non-empty", () => {
    expect(evaluateReadyIntegrated().recommendedNextPhases.length).toBeGreaterThan(0);
    expect(RECOMMENDED_NEXT_PHASES).toContain("prepare_runtime_execution_model_design");
  });

  it("separatedWorkItems includes actual_knowledge_pack_crud", () => {
    expect(evaluateReadyIntegrated().separatedWorkItems).toContain("actual_knowledge_pack_crud");
    expect(SEPARATED_WORK_ITEMS).toContain("actual_rag_indexing");
  });

  it("findings include stage5_knowledge_foundation_ready when ready", () => {
    expect(
      evaluateReadyIntegrated().findings.some((f) => f.code === "stage5_knowledge_foundation_ready"),
    ).toBe(true);
  });

  it("boundaryChecklist all satisfied when ready", () => {
    expect(evaluateReadyIntegrated().boundaryChecklist.every((c) => c.satisfied)).toBe(true);
  });

  it("resolveStage5IntegratedKnowledgeFoundationClosureDecision ready when all sources ready", () => {
    expect(
      resolveStage5IntegratedKnowledgeFoundationClosureDecision({
        sourceStage5AClosureDecision: "stage5_a_closure_ready",
        sourceStage5BDecision: "ready_for_metadata_registry_design",
        sourceStage5CDecision: "ready_for_mapping_design",
        sourceStage5DDecision: "ready_for_prompt_context_design",
      }),
    ).toBe("stage5_knowledge_foundation_ready");
  });

  it("mode and stage are read-only stage 5-F", () => {
    const report = evaluateReadyIntegrated();
    expect(report.mode).toBe("read_only_stage5_integrated_knowledge_foundation_closure");
    expect(report.stage).toBe("stage_5_f_closure");
  });

  it("source decisions echoed on report", () => {
    const report = evaluateReadyIntegrated();
    expect(report.sourceStage5AClosureDecision).toBe("stage5_a_closure_ready");
    expect(report.sourceStage5BDecision).toBe("ready_for_metadata_registry_design");
    expect(report.sourceStage5CDecision).toBe("ready_for_mapping_design");
    expect(report.sourceStage5DDecision).toBe("ready_for_prompt_context_design");
  });

  it("closureSummary states not implementation permission when ready", () => {
    expect(evaluateReadyIntegrated().closureSummary).toContain("not knowledge pack implementation");
  });
});
