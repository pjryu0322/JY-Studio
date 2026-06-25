import type { ProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  buildReferencePlanningWelcomeMessageBody,
  buildReferenceInfoViewMessageBody,
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_MATERIALIZE,
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_CLEAR_NOTICE_BODY,
  REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE,
  REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
  REFERENCE_PLANNING_MATERIALIZE_SUCCESS_INTERNAL_TYPE,
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

export function buildReferencePlanningLegacyMissingMessageMeta() {
  return {
    internalType: REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
    interviewSuggestions: [REFERENCE_PLANNING_CHIP_MATERIALIZE, REFERENCE_PLANNING_CHIP_CLEAR],
  };
}

export function buildReferencePlanningLegacyMissingBody(): string {
  return REFERENCE_PLANNING_LEGACY_MISSING_BODY;
}

export function buildReferencePlanningMaterializeSuccessMessageMeta() {
  return {
    internalType: REFERENCE_PLANNING_MATERIALIZE_SUCCESS_INTERNAL_TYPE,
    interviewSuggestions: [
      REFERENCE_PLANNING_CHIP_VIEW,
      REFERENCE_PLANNING_CHIP_CONTINUE,
      REFERENCE_PLANNING_CHIP_CLEAR,
    ],
  };
}

export {
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_MATERIALIZE,
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
  REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
  REFERENCE_PLANNING_MATERIALIZE_SUCCESS_INTERNAL_TYPE,
  buildReferenceInfoViewMessageBody,
  REFERENCE_PLANNING_CLEAR_NOTICE_BODY,
  REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE,
  REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE,
};
