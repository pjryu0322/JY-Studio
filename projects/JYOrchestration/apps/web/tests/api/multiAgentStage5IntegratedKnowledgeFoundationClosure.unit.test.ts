import { describe, expect, it } from "vitest";
import { listDefaultRoleKnowledgeAgentTypes } from "@/lib/agents/defaultRoleKnowledgeBindings";
import {
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  evaluateStage5IntegratedKnowledgeFoundationClosure,
  evaluateStage5KnowledgeFoundationPipeline,
  RECOMMENDED_NEXT_PHASES,
  resolveStage5IntegratedClosureDecision,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  SEPARATED_WORK_ITEMS,
  validateStage5SourceBoundary,
} from "@/lib/agents/evaluateStage5IntegratedKnowledgeFoundationClosure";
import { buildStage5ReadyChainInput } from "@/lib/agents/stage5KnowledgeFoundationInput";
import type { KnowledgePackMetadataRegistryCandidateReport } from "@/lib/agents/knowledgePackMetadataRegistryCandidateTypes";

function evaluateReadyIntegrated(
  input: Parameters<typeof evaluateStage5IntegratedKnowledgeFoundationClosure>[0] = {},
) {
  return evaluateStage5IntegratedKnowledgeFoundationClosure({
    ...buildStage5ReadyChainInput(),
    ...input,
  });
}

describe("multi-agent stage 5 integrated knowledge foundation closure stage 5-F", () => {
  it("default input without confirmations defers", () => {
    expect(evaluateStage5IntegratedKnowledgeFoundationClosure().decision).toBe("defer");
  });

  it("buildStage5ReadyChainInput enables ready path", () => {
    expect(
      evaluateStage5IntegratedKnowledgeFoundationClosure(buildStage5ReadyChainInput()).decision,
    ).toBe("stage5_knowledge_foundation_ready");
  });

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

  it("exposes sourceStage5AAgentCount", () => {
    expect(evaluateReadyIntegrated().sourceStage5AAgentCount).toBe(listDefaultRoleKnowledgeAgentTypes().length);
  });

  it("exposes sourceStage5BMetadataCandidateCount as number", () => {
    expect(typeof evaluateReadyIntegrated().sourceStage5BMetadataCandidateCount).toBe("number");
    expect(evaluateReadyIntegrated().sourceStage5BMetadataCandidateCount).toBeGreaterThan(0);
  });

  it("exposes sourceStage5CMappingCandidateCount as number", () => {
    expect(typeof evaluateReadyIntegrated().sourceStage5CMappingCandidateCount).toBe("number");
    expect(evaluateReadyIntegrated().sourceStage5CMappingCandidateCount).toBeGreaterThan(0);
  });

  it("exposes sourceStage5DPromptDesignCandidateCount as number", () => {
    expect(typeof evaluateReadyIntegrated().sourceStage5DPromptDesignCandidateCount).toBe("number");
    expect(evaluateReadyIntegrated().sourceStage5DPromptDesignCandidateCount).toBeGreaterThan(0);
  });

  it("exposes sourceStage5AClosureFingerprint", () => {
    const report = evaluateReadyIntegrated();
    expect(report.sourceStage5AClosureFingerprint.length).toBeGreaterThan(0);
    expect(report.sourceStage5AClosureFingerprint).toContain("stage5-a-closure");
  });

  it("sourceStage5FInputMode is shared_stage5_knowledge_foundation_input", () => {
    expect(evaluateReadyIntegrated().sourceStage5FInputMode).toBe("shared_stage5_knowledge_foundation_input");
  });

  it("findings include stage5_pipeline_source_trace_recorded", () => {
    expect(
      evaluateReadyIntegrated().findings.some((f) => f.code === "stage5_pipeline_source_trace_recorded"),
    ).toBe(true);
  });

  it("sourceStage5BRegistryCandidateOnly is true", () => {
    expect(evaluateReadyIntegrated().sourceStage5BRegistryCandidateOnly).toBe(true);
  });

  it("sourceStage5CMappingCandidateOnly is true", () => {
    expect(evaluateReadyIntegrated().sourceStage5CMappingCandidateOnly).toBe(true);
  });

  it("sourceStage5DPromptInjectionDesignOnly is true", () => {
    expect(evaluateReadyIntegrated().sourceStage5DPromptInjectionDesignOnly).toBe(true);
  });

  it("sourceStage5BActualRegistryImplementationAllowed is false", () => {
    expect(evaluateReadyIntegrated().sourceStage5BActualRegistryImplementationAllowed).toBe(false);
  });

  it("sourceStage5CActualMappingWireAllowed is false", () => {
    expect(evaluateReadyIntegrated().sourceStage5CActualMappingWireAllowed).toBe(false);
  });

  it("sourceStage5DActualPromptInjectionWireAllowed is false", () => {
    expect(evaluateReadyIntegrated().sourceStage5DActualPromptInjectionWireAllowed).toBe(false);
  });

  it("sourceStage5DActualRagRetrievalAllowed is false", () => {
    expect(evaluateReadyIntegrated().sourceStage5DActualRagRetrievalAllowed).toBe(false);
  });

  it("findings include stage5_actual_registry_mapping_prompt_rag_disallowed", () => {
    expect(
      evaluateReadyIntegrated().findings.some((f) => f.code === "stage5_actual_registry_mapping_prompt_rag_disallowed"),
    ).toBe(true);
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

  it("recommendedNextPhases mentions stage6 or separate_pr", () => {
    const phases = evaluateReadyIntegrated().recommendedNextPhases;
    expect(phases.some((p) => p.includes("stage6") || p.includes("separate_pr"))).toBe(true);
    expect(RECOMMENDED_NEXT_PHASES).toContain("prepare_stage6_runtime_execution_model_design");
  });

  it("separatedWorkItems includes actual_knowledge_pack_crud and related items", () => {
    const items = evaluateReadyIntegrated().separatedWorkItems;
    expect(items).toContain("actual_knowledge_pack_crud");
    expect(items).toContain("actual_rag_indexing");
    expect(items).toContain("actual_prompt_context_injection_wire");
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

  it("sourceBoundaryVerified is true on ready path", () => {
    expect(evaluateReadyIntegrated().sourceBoundaryVerified).toBe(true);
  });

  it("sourceBoundaryViolationCodes is empty on ready path", () => {
    expect(evaluateReadyIntegrated().sourceBoundaryViolationCodes).toEqual([]);
  });

  it("stage5ActualImplementationDisallowed is true", () => {
    expect(evaluateReadyIntegrated().stage5ActualImplementationDisallowed).toBe(true);
  });

  it("findings include source_stage5_boundary_verified on ready path", () => {
    expect(
      evaluateReadyIntegrated().findings.some((f) => f.code === "source_stage5_boundary_verified"),
    ).toBe(true);
  });

  it("findings include stage5_actual_implementation_disallowed", () => {
    expect(
      evaluateReadyIntegrated().findings.some((f) => f.code === "stage5_actual_implementation_disallowed"),
    ).toBe(true);
  });

  it("stage6EntryMode is design_candidate_only", () => {
    expect(evaluateReadyIntegrated().stage6EntryMode).toBe("design_candidate_only");
  });

  it("stage6ActualRuntimeExecutionAllowed is false", () => {
    expect(evaluateReadyIntegrated().stage6ActualRuntimeExecutionAllowed).toBe(false);
  });

  it("stage6RequiresSeparateApproval is true", () => {
    expect(evaluateReadyIntegrated().stage6RequiresSeparateApproval).toBe(true);
  });

  it("recommendedNextPhases only includes stage6 separate_pr or read_only_hardening patterns", () => {
    const allowedPattern = /stage6|separate_pr|read_only/;
    expect(
      evaluateReadyIntegrated().recommendedNextPhases.every((phase) => allowedPattern.test(phase)),
    ).toBe(true);
  });

  it("separatedWorkItems includes all actual implementation work items", () => {
    const required = [
      "actual_knowledge_pack_crud",
      "actual_rag_indexing",
      "actual_prompt_context_injection_wire",
      "actual_runtime_execution_wire",
      "actual_db_schema_migration",
      "actual_knowledge_pack_management_ui",
    ];
    const items = evaluateReadyIntegrated().separatedWorkItems;
    for (const item of required) {
      expect(items).toContain(item);
    }
  });
});

describe("validateStage5SourceBoundary", () => {
  it("passes for default ready pipeline", () => {
    const pipeline = evaluateStage5KnowledgeFoundationPipeline(buildStage5ReadyChainInput());
    const result = validateStage5SourceBoundary(pipeline);
    expect(result.sourceBoundaryVerified).toBe(true);
    expect(result.sourceBoundaryViolationCodes).toEqual([]);
  });

  it("detects registry candidate-only violation", () => {
    const pipeline = evaluateStage5KnowledgeFoundationPipeline(buildStage5ReadyChainInput());
    const tamperedStage5B = {
      ...pipeline.stage5B,
      registryCandidateOnly: false,
    } as KnowledgePackMetadataRegistryCandidateReport;
    const result = validateStage5SourceBoundary({ ...pipeline, stage5B: tamperedStage5B });
    expect(result.sourceBoundaryVerified).toBe(false);
    expect(result.sourceBoundaryViolationCodes).toContain("source_stage5_b_registry_candidate_only_violation");
  });

  it("forces blocked decision when source boundary is violated", () => {
    const pipeline = evaluateStage5KnowledgeFoundationPipeline(buildStage5ReadyChainInput());
    const tamperedStage5B = {
      ...pipeline.stage5B,
      actualRegistryImplementationAllowedInThisStep: true,
    } as KnowledgePackMetadataRegistryCandidateReport;
    const report = evaluateStage5IntegratedKnowledgeFoundationClosure(buildStage5ReadyChainInput());
    expect(report.sourceBoundaryVerified).toBe(true);

    const boundary = validateStage5SourceBoundary({
      ...pipeline,
      stage5B: tamperedStage5B,
    });
    expect(boundary.sourceBoundaryVerified).toBe(false);
    const sources = {
      sourceStage5AClosureDecision: pipeline.stage5A.decision,
      sourceStage5BDecision: pipeline.stage5B.decision,
      sourceStage5CDecision: pipeline.stage5C.decision,
      sourceStage5DDecision: pipeline.stage5D.decision,
    };
    expect(
      resolveStage5IntegratedClosureDecision({ sources, sourceBoundary: boundary }),
    ).toBe("blocked");
  });
});
