import { beforeEach, describe, expect, it, vi } from "vitest";

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
        actorCount: 1,
        serviceFlowCount: 0,
        featureCount: 0,
        graphReusableNodeCount: 1,
      },
      materializedReferenceContextV1: {
        version: 1,
        sourceProjectTitle: "A",
        snapshotTitle: "S",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        preparedAt: "2026-06-03T00:00:00.000Z",
        graph: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
      },
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
    expect(result.materializedReferenceContextV1?.sourceProjectTitle).toBe("A");
    expect(JSON.stringify(result)).not.toContain("sourceSnapshotId");
    expect(JSON.stringify(result)).not.toContain("entityKey");
    expect(JSON.stringify(result)).not.toContain("revisionId");
  });
});
