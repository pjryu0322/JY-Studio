/**
 * Stage 5-F integrated knowledge foundation closure (read-only).
 */

import type {
  Stage5IntegratedKnowledgeFoundationClosureFinding,
  Stage5IntegratedKnowledgeFoundationClosureInput,
  Stage5IntegratedKnowledgeFoundationClosureReport,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";
import { evaluateStage5KnowledgeFoundationPipeline } from "@/lib/agents/stage5KnowledgeFoundationPipeline";
import {
  appendStage5IntegratedKnowledgeFoundationClosureFindings,
  buildStage5IntegratedBoundaryChecklist,
  buildStage5IntegratedClosureChecklist,
  buildStage5IntegratedClosureSummary,
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  buildStage5IntegratedPipelineTraceFields,
  buildStage5IntegratedSourceDecisions,
  RECOMMENDED_NEXT_PHASES,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  SEPARATED_WORK_ITEMS,
  STAGE5_INTEGRATED_CLOSURE_TITLE,
  STAGE5_INTEGRATED_CLOSURE_VERSION,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureSupport";

export { evaluateStage5KnowledgeFoundationPipeline } from "@/lib/agents/stage5KnowledgeFoundationPipeline";
export type { Stage5KnowledgeFoundationPipelineReports } from "@/lib/agents/stage5KnowledgeFoundationPipeline";

export {
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  buildStage5IntegratedSourceDecisions,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  RECOMMENDED_NEXT_PHASES,
  SEPARATED_WORK_ITEMS,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureSupport";

export type { Stage5IntegratedKnowledgeFoundationClosureDecisionInput } from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

/** Read-only Stage 5-F integrated closure — aggregates 5-A through 5-D. */
export function evaluateStage5IntegratedKnowledgeFoundationClosure(
  input?: Stage5IntegratedKnowledgeFoundationClosureInput,
): Stage5IntegratedKnowledgeFoundationClosureReport {
  const pipeline = evaluateStage5KnowledgeFoundationPipeline(input);
  const sources = buildStage5IntegratedSourceDecisions(pipeline);

  const decision = resolveStage5IntegratedKnowledgeFoundationClosureDecision(sources);
  const closureFingerprint = buildStage5IntegratedKnowledgeFoundationClosureFingerprint(sources);

  const findings: Stage5IntegratedKnowledgeFoundationClosureFinding[] = [];
  appendStage5IntegratedKnowledgeFoundationClosureFindings({ findings, decision, sources, pipeline });

  return {
    mode: "read_only_stage5_integrated_knowledge_foundation_closure",
    stage: "stage_5_f_closure",
    decision,
    ...sources,
    ...buildStage5IntegratedPipelineTraceFields(pipeline),
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
