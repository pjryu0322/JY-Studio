import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMaterializedReferenceContextFromSnapshot,
  parseMaterializedReferenceContextV1,
  type MaterializedReferenceContextV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";

const prepareMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation")>();
  return {
    ...actual,
    prepareReferenceSnapshotSelectionForUser: (...args: unknown[]) => prepareMock(...args),
  };
});

import { ReferenceSnapshotSelectionValidationError } from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";
import { prepareReferenceSelectionForProjectCreate } from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionPrepareService";

const sampleMaterialized = buildMaterializedReferenceContextFromSnapshot({
  sourceProjectTitle: "A",
  snapshotTitle: "S",
  snapshotPurpose: "REFERENCE_CANDIDATE",
  sourceSnapshotId: "revision-internal-only",
  graphSnapshot: {
    purpose: "REFERENCE_CANDIDATE",
    nodes: [
      {
        entityKey: "ek1",
        nodeType: "Actor",
        title: "고객",
        summary: "주문 담당",
        reference: {
          lifecycle: "USER_APPROVED",
          reusable: true,
          reusableAs: ["ACTOR"],
          safeForReference: true,
        },
      },
    ],
    edges: [],
  },
});

describe("prepareReferenceSelectionForProjectCreate", () => {
  beforeEach(() => {
    prepareMock.mockReset();
  });

  it("returns null payload when referenceSnapshotIds is empty", async () => {
    const result = await prepareReferenceSelectionForProjectCreate({
      userId: "u1",
      referenceSnapshotIds: [],
    });
    expect(result).toEqual({
      referenceSelection: null,
      referenceSelectionSummary: null,
      materializedReferenceContextV1: null,
    });
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("throws when more than one snapshot id is provided", async () => {
    await expect(
      prepareReferenceSelectionForProjectCreate({
        userId: "u1",
        referenceSnapshotIds: ["a", "b"],
      }),
    ).rejects.toBeInstanceOf(ReferenceSnapshotSelectionValidationError);
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("maps prepare result to create payload without internal ids", async () => {
    expect(parseMaterializedReferenceContextV1(sampleMaterialized)).not.toBeNull();

    prepareMock.mockResolvedValue({
      selection: {
        referenceSnapshotIds: ["public-snap-id"],
        selectedAt: "2026-06-03T00:00:00.000Z",
        source: "USER_SELECTED",
      },
      summary: {
        sourceProjectTitle: "A",
        snapshotTitle: "S",
        readiness: "READY",
        actorCount: sampleMaterialized.summary.actorCount,
        serviceFlowCount: sampleMaterialized.summary.serviceFlowCount,
        featureCount: sampleMaterialized.summary.featureCount,
        graphReusableNodeCount: sampleMaterialized.summary.graphReusableNodeCount,
      },
      materializedReferenceContextV1: sampleMaterialized satisfies MaterializedReferenceContextV1,
    });

    const result = await prepareReferenceSelectionForProjectCreate({
      userId: "u1",
      referenceSnapshotIds: ["public-snap-id"],
    });

    expect(prepareMock).toHaveBeenCalledWith({
      userId: "u1",
      referenceSnapshotIds: ["public-snap-id"],
    });
    expect(result.referenceSelection).toEqual({
      referenceSnapshotIds: ["public-snap-id"],
      selectedAt: "2026-06-03T00:00:00.000Z",
      source: "USER_SELECTED",
    });
    expect(result.referenceSelectionSummary?.sourceProjectTitle).toBe("A");
    expect(result.materializedReferenceContextV1?.source.sourceProjectTitle).toBe("A");
    expect(parseMaterializedReferenceContextV1(result.materializedReferenceContextV1)).not.toBeNull();
    const publicFacingJson = JSON.stringify({
      referenceSelection: result.referenceSelection,
      referenceSelectionSummary: result.referenceSelectionSummary,
    });
    expect(publicFacingJson).not.toContain("sourceSnapshotId");
    expect(publicFacingJson).not.toContain("revision-internal-only");
    expect(JSON.stringify(result.materializedReferenceContextV1?.nodes)).not.toContain("entityKey");
    expect(JSON.stringify(result)).not.toContain("revisionId");
  });
});
