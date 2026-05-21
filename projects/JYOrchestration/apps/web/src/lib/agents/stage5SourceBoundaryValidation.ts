/**
 * Stage 5-B/C/D source boundary validation for Stage 5-F closure (read-only).
 */

import type { Stage5KnowledgeFoundationPipelineReports } from "@/lib/agents/stage5KnowledgeFoundationPipeline";

export type Stage5SourceBoundaryValidation = {
  readonly sourceBoundaryVerified: boolean;
  readonly sourceBoundaryViolationCodes: readonly string[];
};

function pushWhen(condition: boolean, violations: string[], code: string): void {
  if (condition) {
    violations.push(code);
  }
}

/** Verify Stage 5-B/C/D source reports keep candidate-only and no-implementation posture. */
export function validateStage5SourceBoundary(
  pipeline: Stage5KnowledgeFoundationPipelineReports,
): Stage5SourceBoundaryValidation {
  const { stage5B, stage5C, stage5D } = pipeline;
  const violations: string[] = [];

  pushWhen(stage5B.registryCandidateOnly !== true, violations, "source_stage5_b_registry_candidate_only_violation");
  pushWhen(
    stage5B.actualRegistryImplementationAllowedInThisStep !== false,
    violations,
    "source_stage5_b_actual_registry_allowed_violation",
  );
  pushWhen(stage5B.actualKnowledgePackCrudAllowedInThisStep !== false, violations, "source_stage5_b_crud_allowed_violation");
  pushWhen(stage5B.actualDbWriteAllowedInThisStep !== false, violations, "source_stage5_b_db_write_allowed_violation");
  pushWhen(stage5B.actualRagIndexingAllowedInThisStep !== false, violations, "source_stage5_b_rag_allowed_violation");
  pushWhen(stage5B.actualUiAllowedInThisStep !== false, violations, "source_stage5_b_ui_allowed_violation");

  pushWhen(stage5C.mappingCandidateOnly !== true, violations, "source_stage5_c_mapping_candidate_only_violation");
  pushWhen(
    stage5C.actualRoleKnowledgePackMappingWireAllowedInThisStep !== false,
    violations,
    "source_stage5_c_mapping_wire_allowed_violation",
  );
  pushWhen(
    stage5C.actualPromptInjectionAllowedInThisStep !== false,
    violations,
    "source_stage5_c_prompt_injection_allowed_violation",
  );
  pushWhen(
    stage5C.actualRuntimeBindingAllowedInThisStep !== false,
    violations,
    "source_stage5_c_runtime_binding_allowed_violation",
  );

  pushWhen(stage5D.promptInjectionDesignOnly !== true, violations, "source_stage5_d_prompt_design_only_violation");
  pushWhen(
    stage5D.actualPromptInjectionWireAllowedInThisStep !== false,
    violations,
    "source_stage5_d_prompt_wire_allowed_violation",
  );
  pushWhen(stage5D.actualRagRetrievalAllowedInThisStep !== false, violations, "source_stage5_d_rag_retrieval_allowed_violation");
  pushWhen(
    stage5D.actualRuntimePromptBuilderChangeAllowedInThisStep !== false,
    violations,
    "source_stage5_d_runtime_prompt_builder_allowed_violation",
  );

  return {
    sourceBoundaryVerified: violations.length === 0,
    sourceBoundaryViolationCodes: [...violations].sort((a, b) => a.localeCompare(b)),
  };
}
