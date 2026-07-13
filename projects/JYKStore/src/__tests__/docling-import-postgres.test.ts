/**
 * Optional PostgreSQL integration checks for Docling staging / partial unique.
 * Runs when DATABASE_URL is set; otherwise SKIP (never fake PASS).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe("docling-import-postgres-integration", { skip: !hasDb }, () => {
  it("schema exposes stagingReason, expiresAt, cleanup doclingBundleId", async () => {
    const { prisma } = await import("../lib/prisma.ts");
    // Smoke: Prisma client knows the new fields (compile/runtime shape).
    const bundleSample = await prisma.doclingImportBundle.findFirst({
      select: {
        id: true,
        stagingReason: true,
        expiresAt: true,
        isActive: true,
        storageStatus: true,
      },
    });
    void bundleSample;
    const jobSample = await prisma.payloadStorageCleanupJob.findFirst({
      select: {
        id: true,
        doclingBundleId: true,
        knowledgePackFileId: true,
        status: true,
      },
    });
    void jobSample;
    assert.ok(true);
  });

  it("partial unique index one_active_per_version exists", async () => {
    const { prisma } = await import("../lib/prisma.ts");
    const rows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'DoclingImportBundle_one_active_per_version'`,
    );
    assert.ok(
      rows.length >= 1,
      "expected DoclingImportBundle_one_active_per_version partial unique index",
    );
  });
});
