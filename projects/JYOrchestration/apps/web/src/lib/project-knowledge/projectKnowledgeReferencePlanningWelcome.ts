import type { ProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  buildReferencePlanningWelcomeMessageBody,
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
} from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";

export function buildReferencePlanningWelcomeMessageMeta(summary: ProjectReferenceSelectionSummaryV1) {
  return {
    internalType: REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
    interviewSuggestions: [
      REFERENCE_PLANNING_CHIP_VIEW,
      REFERENCE_PLANNING_CHIP_CLEAR,
      REFERENCE_PLANNING_CHIP_CONTINUE,
    ],
    referencePlanningSummary: {
      sourceProjectTitle: summary.sourceProjectTitle,
      snapshotTitle: summary.snapshotTitle,
      actorCount: summary.actorCount,
      serviceFlowCount: summary.serviceFlowCount,
      featureCount: summary.featureCount,
      graphReusableNodeCount: summary.graphReusableNodeCount,
    },
  };
}

export function buildReferencePlanningWelcomeBody(summary: ProjectReferenceSelectionSummaryV1): string {
  return buildReferencePlanningWelcomeMessageBody(summary);
}

export {
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
};
