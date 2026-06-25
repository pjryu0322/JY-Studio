import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const sessionMock = vi.fn();
const batchMock = vi.fn();
const userFindMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindMock(...args),
    },
  },
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceMaterializationBatchService", () => ({
  clampMaterializeMissingLimit: (n: unknown) => (typeof n === "number" ? n : 50),
  materializeMissingReferenceContextsBatch: (...args: unknown[]) => batchMock(...args),
}));

import { POST } from "@/app/api/projects/reference-selection/materialize-missing/route";

describe("projectReferenceSelectionMaterializeMissingApi", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    batchMock.mockReset();
    userFindMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    userFindMock.mockResolvedValue({ globalRole: "USER", email: "u@example.com" });
  });

  it("rejects unauthenticated requests", async () => {
    sessionMock.mockResolvedValue(
      NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 }),
    );
    const req = new NextRequest("http://localhost/api/projects/reference-selection/materialize-missing", {
      method: "POST",
      body: JSON.stringify({ dryRun: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(batchMock).not.toHaveBeenCalled();
  });

  it("passes dryRun and limit to batch service", async () => {
    batchMock.mockResolvedValue({
      dryRun: true,
      scanned: 1,
      legacyMissing: 1,
      materialized: 0,
      alreadyMaterialized: 0,
      noReferenceSelection: 0,
      failed: 0,
      results: [
        {
          projectId: "p1",
          status: "MATERIALIZED",
          referenceContextSource: "MATERIALIZED",
        },
      ],
    });
    const req = new NextRequest("http://localhost/api/projects/reference-selection/materialize-missing", {
      method: "POST",
      body: JSON.stringify({ dryRun: true, limit: 25 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(batchMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", dryRun: true, limit: 25 }),
    );
    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/sourceSnapshotId|entityKey|revisionId/i);
  });
});
