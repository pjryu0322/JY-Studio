import { beforeEach, describe, expect, it, vi } from "vitest";

const validateMock = vi.fn();
const permissionMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();

const revisionUpdateMock = vi.fn();
const revisionCreateMock = vi.fn();
const graphNodeUpdateMock = vi.fn();
const graphNodeUpdateManyMock = vi.fn();
const graphEdgeUpdateMock = vi.fn();
const graphEdgeUpdateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    projectKnowledgeGraphRevision: {
      update: (...args: unknown[]) => revisionUpdateMock(...args),
      create: (...args: unknown[]) => revisionCreateMock(...args),
    },
    projectGraphNode: {
      update: (...args: unknown[]) => graphNodeUpdateMock(...args),
      updateMany: (...args: unknown[]) => graphNodeUpdateManyMock(...args),
    },
    projectGraphEdge: {
      update: (...args: unknown[]) => graphEdgeUpdateMock(...args),
      updateMany: (...args: unknown[]) => graphEdgeUpdateManyMock(...args),
    },
  },
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation")>();
  return {
    ...actual,
    validateReferenceSnapshotSelectionForUser: (...args: unknown[]) => validateMock(...args),
  };
});

import { ReferenceSnapshotSelectionValidationError } from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";
import { buildMaterializedReferenceContextFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { materializeReferenceContextForProject } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializationService";

const materialized = buildMaterializedReferenceContextFromSnapshot({
  sourceProjectTitle: "Src",
  snapshotTitle: "Snap",
  snapshotPurpose: "REFERENCE_CANDIDATE",
  sourceSnapshotId: "revision-secret",
  graphSnapshot: {
    purpose: "REFERENCE_CANDIDATE",
    nodes: [
      {
        entityKey: "ek1",
        nodeType: "Actor",
        title: "고객",
        summary: null,
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

const legacyState = {
  referenceSelectionV1: {
    referenceSnapshotIds: ["revision-secret"],
    selectedAt: "2026-06-01T00:00:00.000Z",
    source: "USER_SELECTED" as const,
  },
  referenceSelectionSummaryV1: {
    sourceProjectTitle: "Src",
    snapshotTitle: "Snap",
    readiness: "READY" as const,
    actorCount: 0,
    serviceFlowCount: 0,
    featureCount: 0,
    graphReusableNodeCount: 0,
  },
};

describe("materializeReferenceContextForProject", () => {
  beforeEach(() => {
    validateMock.mockReset();
    permissionMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    revisionUpdateMock.mockReset();
    revisionCreateMock.mockReset();
    graphNodeUpdateMock.mockReset();
    graphNodeUpdateManyMock.mockReset();
    graphEdgeUpdateMock.mockReset();
    graphEdgeUpdateManyMock.mockReset();
    permissionMock.mockResolvedValue(undefined);
  });

  it("returns ALREADY_MATERIALIZED when materializedReferenceContextV1 exists", async () => {
    findUniqueMock.mockResolvedValue({
      requirementsStateJson: {
        ...legacyState,
        materializedReferenceContextV1: materialized,
      },
    });
    const result = await materializeReferenceContextForProject({
      projectId: "p1",
      userId: "u1",
    });
    expect(result.status).toBe("ALREADY_MATERIALIZED");
    expect(result.referenceContextSource).toBe("MATERIALIZED");
    expect(validateMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("revision-secret");
  });

  it("returns NO_REFERENCE_SELECTION when referenceSelectionV1 is absent", async () => {
    findUniqueMock.mockResolvedValue({ requirementsStateJson: {} });
    const result = await materializeReferenceContextForProject({
      projectId: "p1",
      userId: "u1",
    });
    expect(result).toEqual({
      status: "NO_REFERENCE_SELECTION",
      projectId: "p1",
      referenceContextSource: "NONE",
    });
  });

  it("materializes legacy project with referenceSelectionV1 only", async () => {
    findUniqueMock.mockResolvedValue({ requirementsStateJson: legacyState });
    validateMock.mockResolvedValue({
      selection: {
        referenceSnapshotIds: ["revision-secret"],
        selectedAt: "2026-06-03T00:00:00.000Z",
        source: "USER_SELECTED",
      },
      summary: {
        sourceProjectTitle: "Src",
        snapshotTitle: "Snap",
        readiness: "READY",
        actorCount: 1,
        serviceFlowCount: 0,
        featureCount: 0,
        graphReusableNodeCount: 1,
      },
      materializedReferenceContextV1: materialized,
    });
    const result = await materializeReferenceContextForProject({
      projectId: "p1",
      userId: "u1",
    });
    expect(result.status).toBe("MATERIALIZED");
    if (result.status !== "MATERIALIZED") throw new Error("expected MATERIALIZED");
    expect(result.counts.graphReusableNodeCount).toBe(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" } }),
    );
    expect(revisionUpdateMock).not.toHaveBeenCalled();
    expect(revisionCreateMock).not.toHaveBeenCalled();
    expect(graphNodeUpdateMock).not.toHaveBeenCalled();
    expect(graphNodeUpdateManyMock).not.toHaveBeenCalled();
    expect(graphEdgeUpdateMock).not.toHaveBeenCalled();
    expect(graphEdgeUpdateManyMock).not.toHaveBeenCalled();
    const updateArg = updateMock.mock.calls[0]?.[0] as {
      data?: { requirementsStateJson?: { materializedReferenceContextV1?: unknown } };
    };
    expect(updateArg.data?.requirementsStateJson?.materializedReferenceContextV1).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/revision-secret|entityKey|ek1/i);
  });

  it("does not call project.update when dryRun=true", async () => {
    findUniqueMock.mockResolvedValue({ requirementsStateJson: legacyState });
    validateMock.mockResolvedValue({
      selection: legacyState.referenceSelectionV1,
      summary: legacyState.referenceSelectionSummaryV1,
      materializedReferenceContextV1: materialized,
    });
    await materializeReferenceContextForProject({
      projectId: "p1",
      userId: "u1",
      dryRun: true,
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("maps source permission denial to SOURCE_PERMISSION_DENIED", async () => {
    findUniqueMock.mockResolvedValue({ requirementsStateJson: legacyState });
    validateMock.mockRejectedValue(
      new ReferenceSnapshotSelectionValidationError("선택한 참조 프로젝트에 접근할 수 없습니다.", 403),
    );
    const result = await materializeReferenceContextForProject({
      projectId: "p1",
      userId: "u1",
    });
    expect(result.status).toBe("SOURCE_PERMISSION_DENIED");
    if (result.status === "SOURCE_PERMISSION_DENIED") {
      expect(result.referenceContextSource).toBe("LEGACY_MISSING");
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("maps missing snapshot to SOURCE_UNAVAILABLE", async () => {
    findUniqueMock.mockResolvedValue({ requirementsStateJson: legacyState });
    validateMock.mockRejectedValue(
      new ReferenceSnapshotSelectionValidationError("선택한 참조 저장본을 사용할 수 없습니다.", 404),
    );
    const result = await materializeReferenceContextForProject({
      projectId: "p1",
      userId: "u1",
    });
    expect(result.status).toBe("SOURCE_UNAVAILABLE");
    expect(JSON.stringify(result)).not.toContain("revision-secret");
    expect(JSON.stringify(result)).not.toMatch(/entityKey|ek1/i);
  });
});
