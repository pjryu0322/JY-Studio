/**
 * Optional PostgreSQL integration checks for Docling staging / partial unique.
 * Runs when DATABASE_URL is set; otherwise SKIP (never fake PASS).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function ensureDatabaseUrlFromDotEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
  if (!existsSync(envPath)) return;
  const match = readFileSync(envPath, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
  if (!match?.[1]) return;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env.DATABASE_URL = value;
}

ensureDatabaseUrlFromDotEnv();

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

  it("partial unique index one_live_staging_per_version exists", async () => {
    const { prisma } = await import("../lib/prisma.ts");
    const rows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'DoclingImportBundle_one_live_staging_per_version'`,
    );
    assert.ok(
      rows.length >= 1,
      "expected DoclingImportBundle_one_live_staging_per_version partial unique index",
    );
  });

  it("NormalizedDocument language metadata columns exist", async () => {
    const { prisma } = await import("../lib/prisma.ts");
    const sample = await prisma.normalizedDocument.findFirst({
      select: {
        id: true,
        language: true,
        languageSource: true,
        languageConfidence: true,
        structureSummaryJson: true,
      },
    });
    void sample;
    assert.ok(true);
  });
});
