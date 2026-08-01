/**
 * Read-only audit: Published revision identity vs provider review binding.
 * Usage: node --import tsx scripts/audit-published-revision-identity.ts [packId...]
 * Prints identity fields only — no secrets/content.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma.ts";
import { loadPublicRetrievalPack } from "../src/lib/retrieval/retrieval-pack-store.ts";
import { resolvePublicRetrievalGenerationScope } from "../src/lib/retrieval/retrieval-generation-scope.ts";
import {
  resolveCurrentPublishTargetGeneration,
  resolveStoreWorkflowMarkers,
} from "../src/lib/store-workflow-markers.ts";
import { parseProviderReviewRevisionBinding } from "../src/lib/store-workflow-provider-review-binding.ts";
import { resolvePublishRecoveryForPack } from "../src/lib/workflow/publish-recovery.ts";

function ensureDatabaseUrlFromDotEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
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

async function auditPack(packId: string) {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true, status: true },
  });
  if (!pack) {
    return { packId, error: "NOT_FOUND" };
  }

  const production = await prisma.searchIndexGeneration.findFirst({
    where: { packId, scope: "PRODUCTION", status: "PROMOTED" },
    orderBy: { promotedAt: "desc" },
    select: { id: true, versionId: true },
  });
  const draft = await resolveCurrentPublishTargetGeneration(packId);
  const markers = await resolveStoreWorkflowMarkers(packId);
  const binding = parseProviderReviewRevisionBinding(markers.providerReviewSummary);
  const publicPack = await loadPublicRetrievalPack(packId);
  let publicServedGenerationId: string | null = null;
  let publicServeError: string | null = null;
  if (publicPack) {
    try {
      const scope = await resolvePublicRetrievalGenerationScope(publicPack.versionId);
      publicServedGenerationId = scope.searchIndexGenerationId;
    } catch (error) {
      publicServeError = error instanceof Error ? error.message : String(error);
    }
  }
  const recovery = await resolvePublishRecoveryForPack(packId);

  const reviewedId = binding?.indexGenerationId ?? null;
  const productionId = production?.id ?? null;
  const identityMatch =
    pack.status === "PUBLISHED" || pack.status === "VERIFIED"
      ? Boolean(reviewedId && publicServedGenerationId && reviewedId === publicServedGenerationId)
      : null;

  const risk =
    publicServeError
      ? "PUBLIC_SERVE_ERROR"
      : Boolean(reviewedId) &&
          Boolean(publicServedGenerationId) &&
          reviewedId !== publicServedGenerationId
        ? "REVIEWED_NE_SERVED"
        : recovery.mode === "PUBLISH_NEW_REVISION" && reviewedId === productionId
          ? "DRAFT_REVIEW_POINTS_AT_PRODUCTION"
          : "OK";

  return {
    packId: pack.packId,
    packStatus: pack.status,
    productionGenerationId: productionId,
    productionVersionId: production?.versionId ?? null,
    latestDraftGenerationId: draft?.id ?? null,
    providerReviewBindingGenerationId: reviewedId,
    serviceValidationPhase: markers.serviceValidationPhase,
    providerReviewPhase: markers.providerReviewPhase,
    publicServedVersionId: publicPack?.versionId ?? null,
    publicServedGenerationId,
    publicServeError,
    recoveryMode: recovery.mode,
    identityMatch,
    risk,
  };
}

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  let packIds = args;
  if (packIds.length === 0) {
    const rows = await prisma.knowledgePack.findMany({
      where: { status: { in: ["PUBLISHED", "VERIFIED", "DRAFT", "REVIEWING"] } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { packId: true },
    });
    packIds = rows.map((r) => r.packId);
  }

  const results = [];
  for (const packId of packIds) {
    results.push(await auditPack(packId));
  }
  console.log(JSON.stringify({ scannedAt: new Date().toISOString(), count: results.length, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
