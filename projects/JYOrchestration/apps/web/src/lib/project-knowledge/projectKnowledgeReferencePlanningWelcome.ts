export {
  buildReferencePlanningWelcomeMessageMeta,
  buildReferencePlanningWelcomeMessageBody,
  buildReferencePlanningLegacyMissingMessageMeta,
  buildReferencePlanningMaterializeSuccessMessageMeta,
  buildReferencePlanningContextPrepareSuccessMessageMeta,
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_MATERIALIZE,
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
  REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
  REFERENCE_PLANNING_MATERIALIZE_SUCCESS_INTERNAL_TYPE,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_INTERNAL_TYPE,
  REFERENCE_PLANNING_CLEAR_NOTICE_BODY,
  REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE,
  REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";

import type { ProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  buildReferencePlanningWelcomeMessageBody,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";
import { buildReferenceInfoViewMessageBody } from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";

export { buildReferenceInfoViewMessageBody };

export function buildReferencePlanningWelcomeBody(summary: ProjectReferenceSelectionSummaryV1): string {
  return buildReferencePlanningWelcomeMessageBody(summary);
}

export function buildReferencePlanningLegacyMissingBody(): string {
  return REFERENCE_PLANNING_LEGACY_MISSING_BODY;
}
