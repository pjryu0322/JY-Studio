import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  parseProjectReferenceSelectionSummaryV1,
  parseProjectReferenceSelectionV1,
  type ProjectReferenceSelectionSummaryV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { parseMaterializedReferenceContextV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { buildReferenceInfoViewMessageBody } from "@/lib/project-knowledge/projectKnowledgeReferenceContextBuilder";

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

/** referenceSelectionV1만 있고 materializedReferenceContextV1가 없을 때 (legacy) */
export function isReferenceContextLegacyMissing(
  state: RequirementsStateJson | null | undefined,
): boolean {
  const selection = parseProjectReferenceSelectionV1(state?.referenceSelectionV1);
  if (!selection) return false;
  return !parseMaterializedReferenceContextV1(state?.materializedReferenceContextV1);
}

/** UI·운영 진단용 — 자동 backfill 없음 */
export const REFERENCE_CONTEXT_LEGACY_MISSING_DIAGNOSTIC_MESSAGE =
  "참조 정보가 이전 형식으로만 저장되어 있어 AI 기획 참조 컨텍스트를 사용할 수 없습니다. 참조를 다시 선택하거나 materialize API로 보정해 주세요.";
