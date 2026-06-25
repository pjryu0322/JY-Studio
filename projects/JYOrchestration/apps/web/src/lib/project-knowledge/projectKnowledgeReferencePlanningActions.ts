import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { parseMaterializedReferenceContextV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { buildReferenceInfoViewMessageBody } from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";
import type { ProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";

export function buildReferenceClearSelectionApiPath(projectId: string): string {
  const pid = String(projectId ?? "").trim();
  return `/api/projects/${encodeURIComponent(pid)}/reference-selection`;
}

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
