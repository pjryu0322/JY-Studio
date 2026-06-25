import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";

export function buildReferenceClearSelectionApiPath(projectId: string): string {
  const pid = String(projectId ?? "").trim();
  return `/api/projects/${encodeURIComponent(pid)}/reference-selection`;
}

export function clearReferenceSelectionStatePatch(): Pick<
  RequirementsStateJson,
  "referenceSelectionV1" | "referenceSelectionSummaryV1" | "referenceSelectionWelcomeShownAt"
> {
  return {
    referenceSelectionV1: null,
    referenceSelectionSummaryV1: null,
    referenceSelectionWelcomeShownAt: null,
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
