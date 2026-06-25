import { parseProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  buildReferencePlanningLegacyMissingMessageMeta,
  buildReferencePlanningWelcomeMessageMeta,
  REFERENCE_PLANNING_LEGACY_MISSING_BODY,
  REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE,
  REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE,
  buildReferencePlanningWelcomeMessageBody,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningUiPolicy";
import { isReferenceContextLegacyMissing } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ReferencePlanningNoticeCandidate =
  | {
      readonly kind: "LEGACY_MISSING";
      readonly body: string;
      readonly meta: Record<string, unknown>;
      readonly patchState: Pick<RequirementsStateJson, "referenceSelectionWelcomeShownAt">;
    }
  | {
      readonly kind: "WELCOME";
      readonly body: string;
      readonly meta: Record<string, unknown>;
      readonly patchState: Pick<RequirementsStateJson, "referenceSelectionWelcomeShownAt">;
    }
  | null;

type NoticeMessageLike = Readonly<{ readonly meta?: { readonly internalType?: string } | null }>;

export function resolveReferencePlanningNoticeCandidate(input: Readonly<{
  readonly workspaceState: RequirementsStateJson;
  readonly existingMessages: readonly NoticeMessageLike[];
  readonly nowIso: string;
}>): ReferencePlanningNoticeCandidate {
  const { workspaceState, existingMessages, nowIso } = input;

  if (
    isReferenceContextLegacyMissing(workspaceState) &&
    !existingMessages.some((m) => m.meta?.internalType === REFERENCE_PLANNING_LEGACY_MISSING_INTERNAL_TYPE)
  ) {
    return {
      kind: "LEGACY_MISSING",
      body: REFERENCE_PLANNING_LEGACY_MISSING_BODY,
      meta: buildReferencePlanningLegacyMissingMessageMeta(),
      patchState: { referenceSelectionWelcomeShownAt: nowIso },
    };
  }

  const summary = parseProjectReferenceSelectionSummaryV1(workspaceState.referenceSelectionSummaryV1);
  if (
    summary &&
    !workspaceState.referenceSelectionWelcomeShownAt &&
    !isReferenceContextLegacyMissing(workspaceState) &&
    !existingMessages.some((m) => m.meta?.internalType === REFERENCE_PLANNING_WELCOME_INTERNAL_TYPE)
  ) {
    return {
      kind: "WELCOME",
      body: buildReferencePlanningWelcomeMessageBody(summary),
      meta: buildReferencePlanningWelcomeMessageMeta(summary),
      patchState: { referenceSelectionWelcomeShownAt: nowIso },
    };
  }

  return null;
}
