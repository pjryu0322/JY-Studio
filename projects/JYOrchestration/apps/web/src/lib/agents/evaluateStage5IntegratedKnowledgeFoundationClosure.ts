/**
 * Stage 5-F integrated knowledge foundation closure (read-only).
 */

import { evaluatePromptContextInjectionDesignCandidate } from "@/lib/agents/evaluatePromptContextInjectionDesignCandidate";
import { evaluateRoleKnowledgeBindingClosure } from "@/lib/agents/evaluateRoleKnowledgeBindingClosure";
import { evaluateKnowledgePackMetadataRegistryCandidate } from "@/lib/agents/evaluateKnowledgePackMetadataRegistryCandidate";
import { evaluateRoleKnowledgePackMappingCandidate } from "@/lib/agents/evaluateRoleKnowledgePackMappingCandidate";
import type {
  Stage5IntegratedKnowledgeFoundationClosureInput,
  Stage5IntegratedKnowledgeFoundationClosureReport,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";
import {
  appendStage5IntegratedKnowledgeFoundationClosureFindings,
  buildStage5IntegratedBoundaryChecklist,
  buildStage5IntegratedClosureChecklist,
  buildStage5IntegratedClosureSummary,
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  RECOMMENDED_NEXT_PHASES,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  SEPARATED_WORK_ITEMS,
  STAGE5_INTEGRATED_CLOSURE_TITLE,
  STAGE5_INTEGRATED_CLOSURE_VERSION,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureSupport";

export {
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  RECOMMENDED_NEXT_PHASES,
  SEPARATED_WORK_ITEMS,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureSupport";

export type { Stage5IntegratedKnowledgeFoundationClosureDecisionInput } from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

/** Read-only Stage 5-F integrated closure — aggregates 5-A through 5-D. */
export function evaluateStage5IntegratedKnowledgeFoundationClosure(
  input?: Stage5IntegratedKnowledgeFoundationClosureInput,
): Stage5IntegratedKnowledgeFoundationClosureReport {
  const stage5AReport = evaluateRoleKnowledgeBindingClosure(input?.stage5AClosure);
  const stage5BReport = evaluateKnowledgePackMetadataRegistryCandidate({
    stage5AClosure: input?.stage5AClosure,
    ...input?.metadataRegistry,
  });
  const stage5CReport = evaluateRoleKnowledgePackMappingCandidate({
    stage5AClosure: input?.stage5AClosure,
    metadataRegistry: input?.metadataRegistry,
    ...input?.mapping,
  });
  const stage5DReport = evaluatePromptContextInjectionDesignCandidate({
    stage5AClosure: input?.stage5AClosure,
    metadataRegistry: input?.metadataRegistry,
    mapping: input?.mapping,
    ...input?.promptDesign,
  });

  const sources = {
    sourceStage5AClosureDecision: stage5AReport.decision,
    sourceStage5BDecision: stage5BReport.decision,
    sourceStage5CDecision: stage5CReport.decision,
    sourceStage5DDecision: stage5DReport.decision,
  };

  const decision = resolveStage5IntegratedKnowledgeFoundationClosureDecision(sources);
  const closureFingerprint = buildStage5IntegratedKnowledgeFoundationClosureFingerprint(sources);

  const findings: import("@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes").Stage5IntegratedKnowledgeFoundationClosureFinding[] =
    [];
  appendStage5IntegratedKnowledgeFoundationClosureFindings({ findings, decision, sources });

  return {
    mode: "read_only_stage5_integrated_knowledge_foundation_closure",
    stage: "stage_5_f_closure",
    decision,
    ...sources,
    closureVersion: STAGE5_INTEGRATED_CLOSURE_VERSION,
    closureTitle: STAGE5_INTEGRATED_CLOSURE_TITLE,
    closureSummary: buildStage5IntegratedClosureSummary(decision),
    closureFingerprint,
    knowledgeFoundationOnly: true,
    actualKnowledgePackImplementationAllowedAfterStage5: false,
    actualKnowledgePackCrudAllowedAfterStage5: false,
    actualRagIndexingAllowedAfterStage5: false,
    actualPromptInjectionAllowedAfterStage5: false,
    actualRuntimeExecutionAllowedAfterStage5: false,
    actualDbMigrationAllowedAfterStage5: false,
    actualUiImplementationAllowedAfterStage5: false,
    stage6EntryCandidate: "runtime_execution_model_design",
    stage6EntryIsCandidateOnly: true,
    closureChecklist: buildStage5IntegratedClosureChecklist(sources),
    boundaryChecklist: buildStage5IntegratedBoundaryChecklist(),
    findings,
    recommendedNextPhases: [...RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...SEPARATED_WORK_ITEMS],
  };
}
