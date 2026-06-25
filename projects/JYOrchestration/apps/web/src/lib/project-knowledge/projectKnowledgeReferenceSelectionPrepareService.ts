import type { MaterializedReferenceContextV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import type {
  ProjectReferenceSelectionSummaryV1,
  ProjectReferenceSelectionV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  assertMvpReferenceSnapshotIdCount,
  normalizeReferenceSnapshotIds,
  prepareReferenceSnapshotSelectionForUser,
} from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";

export type PreparedReferenceSelectionForProjectCreate = Readonly<{
  referenceSelection: ProjectReferenceSelectionV1 | null;
  referenceSelectionSummary: ProjectReferenceSelectionSummaryV1 | null;
  materializedReferenceContextV1: MaterializedReferenceContextV1 | null;
}>;

const EMPTY_PREPARED: PreparedReferenceSelectionForProjectCreate = {
  referenceSelection: null,
  referenceSelectionSummary: null,
  materializedReferenceContextV1: null,
};

export async function prepareReferenceSelectionForProjectCreate(input: Readonly<{
  readonly userId: string;
  readonly referenceSnapshotIds: unknown;
}>): Promise<PreparedReferenceSelectionForProjectCreate> {
  const userId = String(input.userId ?? "").trim();
  const ids = normalizeReferenceSnapshotIds(input.referenceSnapshotIds);
  assertMvpReferenceSnapshotIdCount(ids);
  if (!ids.length) {
    return EMPTY_PREPARED;
  }

  const prepared = await prepareReferenceSnapshotSelectionForUser({
    userId,
    referenceSnapshotIds: ids,
  });

  return {
    referenceSelection: prepared.selection,
    referenceSelectionSummary: prepared.summary,
    materializedReferenceContextV1: prepared.materializedReferenceContextV1,
  };
}
