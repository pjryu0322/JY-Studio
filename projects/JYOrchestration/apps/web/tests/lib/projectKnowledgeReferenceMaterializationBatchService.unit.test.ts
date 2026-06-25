import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const materializeMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceMaterializationService", () => ({
  materializeReferenceContextForProject: (...args: unknown[]) => materializeMock(...args),
}));

import {
  clampMaterializeMissingLimit,
  materializeMissingReferenceContextsBatch,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializationBatchService";

describe("projectKnowledgeReferenceMaterializationBatchService", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    materializeMock.mockReset();
  });

  it("clamps limit to max 200", () => {
    expect(clampMaterializeMissingLimit(undefined)).toBe(50);
    expect(clampMaterializeMissingLimit(500)).toBe(200);
  });

  it("materializes only legacy missing projects and continues after failure", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "p-legacy",
        requirementsStateJson: {
          referenceSelectionV1: {
            referenceSnapshotIds: ["snap"],
            selectedAt: "2026-06-01T00:00:00.000Z",
            source: "USER_SELECTED",
          },
        },
      },
      {
        id: "p-ok",
        requirementsStateJson: {},
      },
      {
        id: "p-fail",
        requirementsStateJson: {
          referenceSelectionV1: {
            referenceSnapshotIds: ["snap2"],
            selectedAt: "2026-06-01T00:00:00.000Z",
            source: "USER_SELECTED",
          },
        },
      },
    ]);
    materializeMock
      .mockResolvedValueOnce({
        status: "MATERIALIZED",
        projectId: "p-legacy",
        referenceContextSource: "MATERIALIZED",
        summary: {
          sourceProjectTitle: "S",
          snapshotTitle: "N",
          readiness: "READY",
          actorCount: 0,
          serviceFlowCount: 0,
          featureCount: 0,
          graphReusableNodeCount: 0,
        },
        counts: {
          actorCount: 0,
          serviceFlowCount: 0,
          featureCount: 0,
          graphReusableNodeCount: 0,
        },
      })
      .mockResolvedValueOnce({
        status: "SOURCE_UNAVAILABLE",
        projectId: "p-fail",
        referenceContextSource: "LEGACY_MISSING",
        message: "참조 저장본을 다시 확인할 수 없습니다. 참조 프로젝트를 다시 선택해 주세요.",
      });

    const result = await materializeMissingReferenceContextsBatch({
      userId: "u1",
      dryRun: true,
      limit: 10,
    });

    expect(result.scanned).toBe(3);
    expect(result.legacyMissing).toBe(2);
    expect(result.materialized).toBe(1);
    expect(result.failed).toBe(1);
    expect(materializeMock).toHaveBeenCalledTimes(2);
    expect(materializeMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ projectId: "p-legacy", dryRun: true }),
    );
    expect(JSON.stringify(result)).not.toMatch(/sourceSnapshotId|entityKey|revisionId/i);
  });
});
