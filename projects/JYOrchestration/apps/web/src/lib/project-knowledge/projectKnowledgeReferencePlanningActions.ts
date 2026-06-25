import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  parseProjectReferenceSelectionSummaryV1,
  parseProjectReferenceSelectionV1,
  type ProjectReferenceSelectionSummaryV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { parseMaterializedReferenceContextV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { buildReferenceInfoViewMessageBody } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";

export function buildReferenceClearSelectionApiPath(projectId: string): string {
  const pid = String(projectId ?? "").trim();
  return `/api/projects/${encodeURIComponent(pid)}/reference-selection`;
}

/** POST legacy path segment `materialize` — compatibility only; prefer this helper name in new code. */
export function buildReferencePrepareContextApiPath(projectId: string): string {
  const pid = String(projectId ?? "").trim();
  return `/api/projects/${encodeURIComponent(pid)}/reference-selection/materialize`;
}

/** @deprecated use `buildReferencePrepareContextApiPath` */
export function buildReferenceMaterializeApiPath(projectId: string): string {
  return buildReferencePrepareContextApiPath(projectId);
}

export {
  REFERENCE_PLANNING_CHIP_PREPARE_CONTEXT,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_DEFAULT_BODY,
  REFERENCE_PLANNING_CONTEXT_PREPARE_SUCCESS_INTERNAL_TYPE,
  REFERENCE_PLANNING_CONTEXT_PREPARE_FAILED_INTERNAL_TYPE,
  REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";

export function clearReferenceSelectionStatePatch(): Pick<
  RequirementsStateJson,
  | "referenceSelectionV1"
  | "referenceSelectionSummaryV1"
  | "referenceSelectionWelcomeShownAt"
  | "materializedReferenceContextV1"
> {
  return {
    referenceSelectionV1: null,
    referenceSelectionSummaryV1: null,
    referenceSelectionWelcomeShownAt: null,
    materializedReferenceContextV1: null,
  };
}

export function shouldSendReferencePlanningContinueToAi(_chipLabel: string): boolean {
  return false;
}

export function readReferenceSelectionSummaryFromState(
  state: RequirementsStateJson | null | undefined,
) {
  return parseProjectReferenceSelectionSummaryV1(state?.referenceSelectionSummaryV1);
}

export function readReferencePlanningDisplaySummaryFromState(
  state: RequirementsStateJson | null | undefined,
): ProjectReferenceSelectionSummaryV1 | null {
  const materialized = parseMaterializedReferenceContextV1(state?.materializedReferenceContextV1);
  if (materialized) {
    const readiness =
      materialized.source.snapshotPurpose === "REFERENCE_PACKAGE" ? "VERIFIED" : "READY";
    return {
      sourceProjectTitle: materialized.source.sourceProjectTitle,
      snapshotTitle: materialized.source.snapshotTitle,
      readiness,
      actorCount: materialized.summary.actorCount,
      serviceFlowCount: materialized.summary.serviceFlowCount,
      featureCount: materialized.summary.featureCount,
      graphReusableNodeCount: materialized.summary.graphReusableNodeCount,
    };
  }
  return readReferenceSelectionSummaryFromState(state);
}

export function buildReferenceInfoViewBodyFromState(
  state: RequirementsStateJson | null | undefined,
): string | null {
  const summary = readReferencePlanningDisplaySummaryFromState(state);
  if (!summary) return null;
  return buildReferenceInfoViewMessageBody(summary);
}

/** referenceSelectionV1만 있고 materializedReferenceContextV1가 없을 때 (legacy) */
export function isReferenceContextLegacyMissing(
  state: RequirementsStateJson | null | undefined,
): boolean {
  const selection = parseProjectReferenceSelectionV1(state?.referenceSelectionV1);
  if (!selection) return false;
  return !parseMaterializedReferenceContextV1(state?.materializedReferenceContextV1);
}
