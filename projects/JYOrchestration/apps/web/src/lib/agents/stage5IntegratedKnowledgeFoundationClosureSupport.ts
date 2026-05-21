/**
 * Stage 5-F integrated knowledge foundation closure support (read-only).
 */

import type { Stage5KnowledgeFoundationPipelineReports } from "@/lib/agents/stage5KnowledgeFoundationPipeline";
import { STAGE5_INTEGRATED_BOUNDARY_CHECKLIST_ENTRIES } from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureConstants";
export {
  RECOMMENDED_NEXT_PHASES,
  SEPARATED_WORK_ITEMS,
  STAGE5_INTEGRATED_CLOSURE_TITLE,
  STAGE5_INTEGRATED_CLOSURE_VERSION,
  STAGE5_INTEGRATED_POSTURE_REPORT,
  STAGE6_ENTRY_GUARD_REPORT,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureConstants";
import type {
  Stage5IntegratedKnowledgeFoundationClosureChecklistItem,
  Stage5IntegratedKnowledgeFoundationClosureDecision,
  Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
  Stage5IntegratedKnowledgeFoundationClosureFinding,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";
import {
  validateStage5SourceBoundary,
  type Stage5SourceBoundaryValidation,
} from "@/lib/agents/stage5SourceBoundaryValidation";

export type { Stage5KnowledgeFoundationPipelineReports } from "@/lib/agents/stage5KnowledgeFoundationPipeline";
export { validateStage5SourceBoundary, type Stage5SourceBoundaryValidation } from "@/lib/agents/stage5SourceBoundaryValidation";

/** Map pipeline reports to Stage 5-F source decision fields. */
export function buildStage5IntegratedSourceDecisions(
  pipeline: Stage5KnowledgeFoundationPipelineReports,
): Stage5IntegratedKnowledgeFoundationClosureDecisionInput {
  return {
    sourceStage5AClosureDecision: pipeline.stage5A.decision,
    sourceStage5BDecision: pipeline.stage5B.decision,
    sourceStage5CDecision: pipeline.stage5C.decision,
    sourceStage5DDecision: pipeline.stage5D.decision,
  };
}

/** Apply source boundary gate on top of pure source-stage decision. */
export function resolveStage5IntegratedClosureDecision(input: {
  readonly sources: Stage5IntegratedKnowledgeFoundationClosureDecisionInput;
  readonly sourceBoundary: Stage5SourceBoundaryValidation;
}): Stage5IntegratedKnowledgeFoundationClosureDecision {
  if (!input.sourceBoundary.sourceBoundaryVerified) {
    return "blocked";
  }
  return resolveStage5IntegratedKnowledgeFoundationClosureDecision(input.sources);
}

type ChecklistEntry = {
  readonly item: string;
  readonly satisfied: boolean;
  readonly detail: string;
};

function finding(
  severity: Stage5IntegratedKnowledgeFoundationClosureFinding["severity"],
  code: string,
  message: string,
): Stage5IntegratedKnowledgeFoundationClosureFinding {
  return { severity, code, message };
}

function mapChecklist(entries: readonly ChecklistEntry[]): Stage5IntegratedKnowledgeFoundationClosureChecklistItem[] {
  return entries.map((entry) => ({
    item: entry.item,
    satisfied: entry.satisfied,
    reason: `${entry.item}: ${entry.satisfied ? "satisfied" : "not satisfied"} — ${entry.detail}`,
  }));
}

export function resolveStage5IntegratedKnowledgeFoundationClosureDecision(
  input: Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
): Stage5IntegratedKnowledgeFoundationClosureDecision {
  const sources = [
    input.sourceStage5AClosureDecision,
    input.sourceStage5BDecision,
    input.sourceStage5CDecision,
    input.sourceStage5DDecision,
  ];

  if (sources.some((d) => d === "blocked")) {
    return "blocked";
  }

  if (
    sources.some((d) => d === "defer") ||
    input.sourceStage5AClosureDecision !== "stage5_a_closure_ready" ||
    input.sourceStage5BDecision !== "ready_for_metadata_registry_design" ||
    input.sourceStage5CDecision !== "ready_for_mapping_design" ||
    input.sourceStage5DDecision !== "ready_for_prompt_context_design"
  ) {
    return "defer";
  }

  return "stage5_knowledge_foundation_ready";
}

export function buildStage5IntegratedKnowledgeFoundationClosureFingerprint(
  input: Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
): string {
  return [
    "stage5-integrated-closure-v1",
    `5a-${input.sourceStage5AClosureDecision}`,
    `5b-${input.sourceStage5BDecision}`,
    `5c-${input.sourceStage5CDecision}`,
    `5d-${input.sourceStage5DDecision}`,
  ].join(":");
}

export function buildStage5IntegratedClosureSummary(
  decision: Stage5IntegratedKnowledgeFoundationClosureDecision,
): string {
  if (decision === "blocked") {
    return "Stage 5 integrated knowledge foundation closure is blocked due to a source stage decision.";
  }
  if (decision === "defer") {
    return "Stage 5 integrated knowledge foundation closure defers; one or more source stages are not ready.";
  }
  return "Stage 5 integrated read-only knowledge foundation meets closure criteria. This is not knowledge pack implementation permission.";
}

export function buildStage5IntegratedClosureChecklist(
  input: Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
): Stage5IntegratedKnowledgeFoundationClosureChecklistItem[] {
  return mapChecklist([
    {
      item: "Stage 5-A closure ready",
      satisfied: input.sourceStage5AClosureDecision === "stage5_a_closure_ready",
      detail: `sourceStage5AClosureDecision=${input.sourceStage5AClosureDecision}`,
    },
    {
      item: "Stage 5-B metadata registry candidate ready",
      satisfied: input.sourceStage5BDecision === "ready_for_metadata_registry_design",
      detail: `sourceStage5BDecision=${input.sourceStage5BDecision}`,
    },
    {
      item: "Stage 5-C mapping candidate ready",
      satisfied: input.sourceStage5CDecision === "ready_for_mapping_design",
      detail: `sourceStage5CDecision=${input.sourceStage5CDecision}`,
    },
    {
      item: "Stage 5-D prompt design candidate ready",
      satisfied: input.sourceStage5DDecision === "ready_for_prompt_context_design",
      detail: `sourceStage5DDecision=${input.sourceStage5DDecision}`,
    },
    {
      item: "knowledge foundation only",
      satisfied: true,
      detail: "knowledgeFoundationOnly=true",
    },
    {
      item: "Stage 6 entry candidate only",
      satisfied: true,
      detail: "stage6EntryIsCandidateOnly=true",
    },
  ]);
}

export function buildStage5IntegratedPipelineTraceFields(
  pipeline: Stage5KnowledgeFoundationPipelineReports,
): {
  readonly sourceStage5APipelineMode: "role_knowledge_binding_closure";
  readonly sourceStage5BPipelineMode: "knowledge_pack_metadata_registry_candidate";
  readonly sourceStage5CPipelineMode: "role_knowledge_pack_mapping_candidate";
  readonly sourceStage5DPipelineMode: "prompt_context_injection_design_candidate";
  readonly sourceStage5AAgentCount: number;
  readonly sourceStage5BMetadataCandidateCount: number;
  readonly sourceStage5CMappingCandidateCount: number;
  readonly sourceStage5DPromptDesignCandidateCount: number;
  readonly sourceStage5AClosureFingerprint: string;
  readonly sourceStage5FInputMode: "shared_stage5_knowledge_foundation_input";
  readonly sourceStage5BRegistryCandidateOnly: true;
  readonly sourceStage5CMappingCandidateOnly: true;
  readonly sourceStage5DPromptInjectionDesignOnly: true;
  readonly sourceStage5BActualRegistryImplementationAllowed: false;
  readonly sourceStage5CActualMappingWireAllowed: false;
  readonly sourceStage5DActualPromptInjectionWireAllowed: false;
  readonly sourceStage5DActualRagRetrievalAllowed: false;
} {
  const { stage5A, stage5B, stage5C, stage5D } = pipeline;
  return {
    sourceStage5APipelineMode: "role_knowledge_binding_closure",
    sourceStage5BPipelineMode: "knowledge_pack_metadata_registry_candidate",
    sourceStage5CPipelineMode: "role_knowledge_pack_mapping_candidate",
    sourceStage5DPipelineMode: "prompt_context_injection_design_candidate",
    sourceStage5AAgentCount: stage5A.agentCount,
    sourceStage5BMetadataCandidateCount: stage5B.candidateCount,
    sourceStage5CMappingCandidateCount: stage5C.mappingCandidateCount,
    sourceStage5DPromptDesignCandidateCount: stage5D.designCandidateCount,
    sourceStage5AClosureFingerprint: stage5A.closureFingerprint,
    sourceStage5FInputMode: "shared_stage5_knowledge_foundation_input",
    sourceStage5BRegistryCandidateOnly: stage5B.registryCandidateOnly,
    sourceStage5CMappingCandidateOnly: stage5C.mappingCandidateOnly,
    sourceStage5DPromptInjectionDesignOnly: stage5D.promptInjectionDesignOnly,
    sourceStage5BActualRegistryImplementationAllowed: stage5B.actualRegistryImplementationAllowedInThisStep,
    sourceStage5CActualMappingWireAllowed: stage5C.actualRoleKnowledgePackMappingWireAllowedInThisStep,
    sourceStage5DActualPromptInjectionWireAllowed: stage5D.actualPromptInjectionWireAllowedInThisStep,
    sourceStage5DActualRagRetrievalAllowed: stage5D.actualRagRetrievalAllowedInThisStep,
  };
}

export function appendStage5IntegratedPipelineTraceFindings(
  findings: Stage5IntegratedKnowledgeFoundationClosureFinding[],
  pipeline: Stage5KnowledgeFoundationPipelineReports,
): void {
  const trace = buildStage5IntegratedPipelineTraceFields(pipeline);

  findings.push(
    finding("info", "stage5_pipeline_source_trace_recorded", "Stage 5 pipeline source trace recorded on closure report"),
  );
  findings.push(
    finding("info", "stage5_a_source_fingerprint_recorded", `Stage 5-A closure fingerprint: ${trace.sourceStage5AClosureFingerprint}`),
  );
  findings.push(
    finding(
      "info",
      "stage5_b_metadata_candidate_count_recorded",
      `Stage 5-B metadata candidate count: ${trace.sourceStage5BMetadataCandidateCount}`,
    ),
  );
  findings.push(
    finding(
      "info",
      "stage5_c_mapping_candidate_count_recorded",
      `Stage 5-C mapping candidate count: ${trace.sourceStage5CMappingCandidateCount}`,
    ),
  );
  findings.push(
    finding(
      "info",
      "stage5_d_prompt_design_candidate_count_recorded",
      `Stage 5-D prompt design candidate count: ${trace.sourceStage5DPromptDesignCandidateCount}`,
    ),
  );
  findings.push(
    finding("info", "stage5_b_registry_candidate_only_confirmed", "Stage 5-B registry remains candidate only"),
  );
  findings.push(
    finding("info", "stage5_c_mapping_candidate_only_confirmed", "Stage 5-C mapping remains candidate only"),
  );
  findings.push(
    finding("info", "stage5_d_prompt_design_candidate_only_confirmed", "Stage 5-D prompt design remains candidate only"),
  );
  findings.push(
    finding(
      "info",
      "stage5_actual_registry_mapping_prompt_rag_disallowed",
      "Actual registry implementation, mapping wire, prompt injection wire, and RAG retrieval remain disallowed",
    ),
  );
}

export function buildStage5IntegratedBoundaryChecklist(): Stage5IntegratedKnowledgeFoundationClosureChecklistItem[] {
  return mapChecklist(
    STAGE5_INTEGRATED_BOUNDARY_CHECKLIST_ENTRIES.map((entry) => ({
      item: entry.item,
      satisfied: true,
      detail: entry.detail,
    })),
  );
}

export function appendStage5IntegratedKnowledgeFoundationClosureFindings(input: {
  readonly findings: Stage5IntegratedKnowledgeFoundationClosureFinding[];
  readonly decision: Stage5IntegratedKnowledgeFoundationClosureDecision;
  readonly sources: Stage5IntegratedKnowledgeFoundationClosureDecisionInput;
  readonly pipeline: Stage5KnowledgeFoundationPipelineReports;
  readonly sourceBoundary: Stage5SourceBoundaryValidation;
}): void {
  const { findings, decision, sources, pipeline, sourceBoundary } = input;

  appendStage5IntegratedPipelineTraceFindings(findings, pipeline);

  findings.push(finding("info", "stage5_integrated_closure_evaluator_created", "Stage 5-F integrated closure evaluator created"));
  findings.push(finding("info", "stage5_integrated_read_only", "Stage 5 integrated closure is read-only"));
  findings.push(finding("info", "stage5_not_knowledge_pack_implementation", "Stage 5 is not knowledge pack implementation"));
  findings.push(finding("info", "stage5_no_rag_indexing", "Stage 5 integrated closure does not allow RAG indexing"));
  findings.push(finding("info", "stage5_no_prompt_injection_wire", "Stage 5 integrated closure does not wire prompt injection"));
  findings.push(finding("info", "stage5_actual_implementation_disallowed", "Stage 5 does not allow actual knowledge foundation implementation"));
  findings.push(finding("info", "stage6_entry_candidate_only", "Stage 6 runtime execution model design is candidate only"));

  if (sourceBoundary.sourceBoundaryVerified) {
    findings.push(finding("info", "source_stage5_boundary_verified", "Stage 5-B/C/D source boundary flags verified"));
  } else {
    findings.push(
      finding("blocking", "source_stage5_boundary_violation_detected", "Stage 5 source boundary violation detected"),
    );
    for (const code of sourceBoundary.sourceBoundaryViolationCodes) {
      findings.push(finding("blocking", code, `Source boundary violation: ${code}`));
    }
  }

  if (decision === "blocked") {
    if (sources.sourceStage5AClosureDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_a_blocked", "Source Stage 5-A closure is blocked"));
    }
    if (sources.sourceStage5BDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_b_blocked", "Source Stage 5-B decision is blocked"));
    }
    if (sources.sourceStage5CDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_c_blocked", "Source Stage 5-C decision is blocked"));
    }
    if (sources.sourceStage5DDecision === "blocked") {
      findings.push(finding("blocking", "source_stage5_d_blocked", "Source Stage 5-D decision is blocked"));
    }
    findings.push(finding("blocking", "stage5_integrated_closure_blocked", "Stage 5 integrated closure is blocked"));
    return;
  }

  if (decision === "defer") {
    if (sources.sourceStage5AClosureDecision === "defer") {
      findings.push(finding("warning", "source_stage5_a_deferred", "Source Stage 5-A closure defers"));
    }
    if (sources.sourceStage5BDecision === "defer") {
      findings.push(finding("warning", "source_stage5_b_deferred", "Source Stage 5-B decision defers"));
    }
    if (sources.sourceStage5CDecision === "defer") {
      findings.push(finding("warning", "source_stage5_c_deferred", "Source Stage 5-C decision defers"));
    }
    if (sources.sourceStage5DDecision === "defer") {
      findings.push(finding("warning", "source_stage5_d_deferred", "Source Stage 5-D decision defers"));
    }
    findings.push(finding("warning", "stage5_integrated_closure_deferred", "Stage 5 integrated closure defers"));
    return;
  }

  findings.push(finding("info", "stage5_knowledge_foundation_ready", "Stage 5 knowledge foundation closure is ready"));
}
