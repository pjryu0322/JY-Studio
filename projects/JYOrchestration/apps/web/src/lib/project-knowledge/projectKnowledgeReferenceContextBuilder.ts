/**
 * @deprecated Compatibility re-exports only.
 * Do not use this module as a UI policy source — import from `projectKnowledgeReferencePlanningUiPolicy.ts`.
 * Legacy snapshot-array prompt assembly was removed; use `materializedReferenceContextV1` and
 * `buildReferencePromptContextForProjectTurn` for runtime prompt injection.
 */

export {
  REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
  REFERENCE_PLANNING_CHIP_VIEW,
  REFERENCE_PLANNING_CHIP_CLEAR,
  REFERENCE_PLANNING_CHIP_CONTINUE,
  REFERENCE_PLANNING_CHIP_MATERIALIZE,
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_INFO_VIEW_INTERNAL_TYPE,
  REFERENCE_PLANNING_CLEAR_NOTICE_INTERNAL_TYPE,
  REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
  REFERENCE_PLANNING_MATERIALIZE_SUCCESS_INTERNAL_TYPE,
  REFERENCE_PLANNING_MATERIALIZE_FAILED_INTERNAL_TYPE,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_INTERNAL_TYPE,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_INTERNAL_TYPE,
  REFERENCE_PLANNING_CLEAR_NOTICE_BODY,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_MATERIALIZE_SUCCESS_BODY,
  REFERENCE_PLANNING_MATERIALIZE_FAILED_DEFAULT_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY,
  buildReferencePlanningWelcomeMessageBody,
  buildReferencePlanningWelcomeMessageMeta,
  buildReferencePlanningLegacyMissingMessageMeta,
  buildReferencePlanningMaterializeSuccessMessageMeta,
  buildReferencePlanningContextPrepareSuccessMessageMeta,
  buildReferenceInfoViewMessageBody,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";
