/**
 * Stage 5-F integrated knowledge foundation closure (read-only).
 */

import {
  RECOMMENDED_NEXT_PHASES,
  SEPARATED_WORK_ITEMS,
  STAGE5_INTEGRATED_CLOSURE_TITLE,
  STAGE5_INTEGRATED_CLOSURE_VERSION,
  STAGE5_INTEGRATED_POSTURE_REPORT,
  STAGE6_ENTRY_GUARD_REPORT,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureConstants";
import type {
  Stage5IntegratedKnowledgeFoundationClosureFinding,
  Stage5IntegratedKnowledgeFoundationClosureInput,
  Stage5IntegratedKnowledgeFoundationClosureReport,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";
import {
  appendStage5IntegratedKnowledgeFoundationClosureFindings,
  buildStage5IntegratedBoundaryChecklist,
  buildStage5IntegratedClosureChecklist,
  buildStage5IntegratedClosureSummary,
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  buildStage5IntegratedPipelineTraceFields,
  buildStage5IntegratedSourceDecisions,
  resolveStage5IntegratedClosureDecision,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  validateStage5SourceBoundary,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureSupport";
import { evaluateStage5KnowledgeFoundationPipeline } from "@/lib/agents/stage5KnowledgeFoundationPipeline";

export { evaluateStage5KnowledgeFoundationPipeline } from "@/lib/agents/stage5KnowledgeFoundationPipeline";
export type { Stage5KnowledgeFoundationPipelineReports } from "@/lib/agents/stage5KnowledgeFoundationPipeline";

export {
  RECOMMENDED_NEXT_PHASES,
  SEPARATED_WORK_ITEMS,
  STAGE5_INTEGRATED_POSTURE_REPORT,
  STAGE6_ENTRY_GUARD_REPORT,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureConstants";

export {
  buildStage5IntegratedKnowledgeFoundationClosureFingerprint,
  buildStage5IntegratedSourceDecisions,
  resolveStage5IntegratedClosureDecision,
  resolveStage5IntegratedKnowledgeFoundationClosureDecision,
  validateStage5SourceBoundary,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureSupport";

export type {
  Stage5IntegratedKnowledgeFoundationClosureDecisionInput,
  Stage6EntryCandidate,
  Stage6EntryMode,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

export type { Stage5SourceBoundaryValidation } from "@/lib/agents/stage5SourceBoundaryValidation";

/** Read-only Stage 5-F integrated closure — aggregates 5-A through 5-D. */
export function evaluateStage5IntegratedKnowledgeFoundationClosure(
  input?: Stage5IntegratedKnowledgeFoundationClosureInput,
): Stage5IntegratedKnowledgeFoundationClosureReport {
  const pipeline = evaluateStage5KnowledgeFoundationPipeline(input);
  const sources = buildStage5IntegratedSourceDecisions(pipeline);
  const sourceBoundary = validateStage5SourceBoundary(pipeline);
  const decision = resolveStage5IntegratedClosureDecision({ sources, sourceBoundary });
  const closureFingerprint = buildStage5IntegratedKnowledgeFoundationClosureFingerprint(sources);

  const findings: Stage5IntegratedKnowledgeFoundationClosureFinding[] = [];
  appendStage5IntegratedKnowledgeFoundationClosureFindings({
    findings,
    decision,
    sources,
    pipeline,
    sourceBoundary,
  });

  return {
    mode: "read_only_stage5_integrated_knowledge_foundation_closure",
    stage: "stage_5_f_closure",
    decision,
    ...sources,
    ...buildStage5IntegratedPipelineTraceFields(pipeline),
    sourceBoundaryVerified: sourceBoundary.sourceBoundaryVerified,
    sourceBoundaryViolationCodes: sourceBoundary.sourceBoundaryViolationCodes,
    ...STAGE5_INTEGRATED_POSTURE_REPORT,
    closureVersion: STAGE5_INTEGRATED_CLOSURE_VERSION,
    closureTitle: STAGE5_INTEGRATED_CLOSURE_TITLE,
    closureSummary: buildStage5IntegratedClosureSummary(decision),
    closureFingerprint,
    ...STAGE6_ENTRY_GUARD_REPORT,
    closureChecklist: buildStage5IntegratedClosureChecklist(sources),
    boundaryChecklist: buildStage5IntegratedBoundaryChecklist(),
    findings,
    recommendedNextPhases: [...RECOMMENDED_NEXT_PHASES],
    separatedWorkItems: [...SEPARATED_WORK_ITEMS],
  };
}
