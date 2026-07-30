/**
 * P4.3.1 — Canonical Admin E2E driver (service-layer = Admin/Provider API services).
 * Does NOT call Worker CLI directly for Generation.
 *
 * Usage: node --import tsx scripts/p4-3-1-admin-e2e.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { createProviderPackForClient } from "@/lib/provider-pack/provider-pack-write-service";
import {
  acceptAdminWorkerZipRequest,
  runAdminWorkerZipGeneration,
  submitProviderWorkerZipRequest,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import { ensureInventoryAfterAccept } from "@/lib/knowledge-scope/inventory-create-service";
import {
  bulkUpdateInventoryItemDecisions,
  finalizeKnowledgeScopeInventory,
} from "@/lib/knowledge-scope/inventory-decision-service";
import { resolveGenerationOutcome } from "@/lib/workflow/generation-outcome";

const ZIP_PATH = "C:/doc/JYKStore/rMateGridH5Web_v6.0_EN_Trial.zip";
const OUT_DIR = path.join(process.cwd(), "tmp-p4-3-1-e2e");

const PROVIDER_USER_ID = "cmrdhlvzc0000une8891m7f7v";
const PROVIDER_CLIENT_ID = "jyk_client_659c2982-08ed-4b94-8067-62072e1a4467";
const ADMIN_USER_ID = "cmresdbmn0001un4oe6fbhdyo";
const ADMIN_CLIENT_ID = "jyk_client_p431_admin_e2e";

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const startedAt = Date.now();
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    zipPath: ZIP_PATH,
  };

  const packId = `p431e2e${Date.now().toString(36)}`.slice(0, 40).toLowerCase();
  console.log("[1] create pack", packId);
  const created = await createProviderPackForClient(PROVIDER_USER_ID, PROVIDER_CLIENT_ID, {
    packId,
    name: `P4.3.1 E2E Trial ${stamp().slice(0, 16)}`,
    categoryId: "ui",
    description: "P4.3.1 Admin E2E validation pack — Trial ZIP canonical workflow.",
    tags: ["p431", "e2e", "rmate"],
    version: "v6.0-e2e",
  });
  if ("error" in created && created.error) {
    throw new Error(`create pack failed: ${created.error}`);
  }
  report.packCreate = created;
  const versionId =
    (created as { version?: { id?: string }; pack?: { versions?: { id: string }[] } }).version?.id ||
    (
      await prisma.knowledgePackVersion.findFirst({
        where: { packId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    )?.id;
  if (!versionId) throw new Error("versionId missing after create");
  report.packId = packId;
  report.versionId = versionId;
  console.log("  versionId", versionId);

  console.log("[2] submit ZIP");
  const bytes = new Uint8Array(readFileSync(ZIP_PATH));
  const submit = await submitProviderWorkerZipRequest({
    userId: PROVIDER_USER_ID,
    clientId: PROVIDER_CLIENT_ID,
    packId,
    bytes,
    originalFileName: "rMateGridH5Web_v6.0_EN_Trial.zip",
  });
  report.submit = {
    packId: submit.packId,
    versionId: submit.versionId,
    request: submit.request,
  };
  const sourceRevisionId = submit.request.sourceRevisionId;
  console.log("  sourceRevisionId", sourceRevisionId);

  console.log("[3] admin accept");
  const accept = await acceptAdminWorkerZipRequest({
    adminUserId: ADMIN_USER_ID,
    clientId: ADMIN_CLIENT_ID,
    packId,
  });
  report.accept = accept;

  console.log("[4] ensure inventory (explicit)");
  let inventory = await ensureInventoryAfterAccept({
    packId,
    versionId,
    clientId: ADMIN_CLIENT_ID,
    adminUserId: ADMIN_USER_ID,
  });
  if (!inventory) {
    throw new Error("Inventory bootstrap returned null after accept");
  }
  report.inventoryAfterAccept = inventory;
  console.log("  inventoryId", inventory.id, "WC", inventory.workingCopyId, "status", inventory.status);

  const versionRow = await prisma.knowledgePackVersion.findUnique({
    where: { id: versionId },
    select: { currentWorkingCopyId: true },
  });
  report.currentWorkingCopyId = versionRow?.currentWorkingCopyId ?? null;
  if (!versionRow?.currentWorkingCopyId) {
    throw new Error("E2E BLOCKER: currentWorkingCopyId is null after accept/inventory");
  }
  if (inventory.workingCopyId !== versionRow.currentWorkingCopyId) {
    throw new Error(
      `E2E BLOCKER: inventory.workingCopyId (${inventory.workingCopyId}) != currentWorkingCopyId (${versionRow.currentWorkingCopyId})`,
    );
  }

  console.log("[5] resolve PENDING → INCLUDE, REVIEW_REQUIRED → EXCLUDE");
  const pending = await prisma.knowledgeScopeInventoryItem.findMany({
    where: { inventoryId: inventory.id, decision: "PENDING" },
    select: { id: true },
  });
  const review = await prisma.knowledgeScopeInventoryItem.findMany({
    where: { inventoryId: inventory.id, decision: "REVIEW_REQUIRED" },
    select: { id: true, relativePath: true, exclusionReasonText: true, fileName: true },
  });
  report.pendingCountBefore = pending.length;
  report.reviewRequiredItems = review;
  console.log("  PENDING", pending.length, "REVIEW_REQUIRED", review.length);

  // Batch INCLUDE in chunks of 100
  for (let i = 0; i < pending.length; i += 100) {
    const slice = pending.slice(i, i + 100).map((x) => x.id);
    await bulkUpdateInventoryItemDecisions({
      inventoryId: inventory.id,
      itemIds: slice,
      action: "INCLUDE",
      actorUserId: ADMIN_USER_ID,
    });
  }
  if (review.length > 0) {
    await bulkUpdateInventoryItemDecisions({
      inventoryId: inventory.id,
      itemIds: review.map((x) => x.id),
      action: "EXCLUDE",
      actorUserId: ADMIN_USER_ID,
      exclusionReasonCode: "OTHER",
      exclusionReasonText: "P4.3.1 E2E: license/review targets excluded (not knowledge INCLUDE)",
    });
  }

  console.log("[6] FINALIZE inventory");
  inventory = await finalizeKnowledgeScopeInventory({
    inventoryId: inventory.id,
    actorUserId: ADMIN_USER_ID,
  });
  report.inventoryFinalized = inventory;
  console.log(
    "  status",
    inventory.status,
    "included",
    inventory.counts.included,
    "excluded",
    inventory.counts.excluded,
  );
  if (inventory.status !== "FINALIZED") {
    throw new Error(`Finalize failed: status=${inventory.status}`);
  }

  const includedItems = await prisma.knowledgeScopeInventoryItem.findMany({
    where: { inventoryId: inventory.id, decision: "INCLUDED" },
    select: { id: true, relativePath: true },
  });
  report.includedPaths = includedItems.map((i) => i.relativePath).sort();
  report.includedCount = includedItems.length;

  console.log("[7] Admin Generation (Worker→Import→Auto Quality) — this takes ~10+ min");
  const genStarted = Date.now();
  const genResult = await runAdminWorkerZipGeneration({
    adminUserId: ADMIN_USER_ID,
    clientId: ADMIN_CLIENT_ID,
    packId,
  });
  report.generationMs = Date.now() - genStarted;
  report.generationResult = {
    ok: genResult.ok,
    pipelineRunId: genResult.pipelineRunId,
    searchIndexGenerationId: genResult.searchIndexGenerationId,
    importedChunkCount: genResult.importedChunkCount,
    importedEmbeddingCount: genResult.importedEmbeddingCount,
    generationReady: genResult.generationReady,
    nextStep: genResult.nextStep,
    warnings: genResult.warnings,
    error: genResult.error ?? null,
    exclusionSummary: genResult.exclusionSummary ?? null,
  };
  console.log("  gen ok", genResult.ok, "chunks", genResult.importedChunkCount, "ready", genResult.generationReady);

  if (!genResult.ok || !genResult.generationReady) {
    writeFileSync(path.join(OUT_DIR, "e2e-report.json"), JSON.stringify(report, null, 2));
    throw new Error(
      `Generation failed: ${genResult.error?.code ?? "unknown"} ${genResult.error?.message ?? ""}`,
    );
  }

  console.log("[8] provenance integrity over all imported chunks");
  const generationId = genResult.searchIndexGenerationId!;
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { chunkGenerationId: generationId, isActive: true },
    select: { id: true, metadata: true, sourceDocumentId: true },
  });
  const itemById = new Map(
    (
      await prisma.knowledgeScopeInventoryItem.findMany({
        where: { inventoryId: inventory.id },
        select: { id: true, relativePath: true, decision: true },
      })
    ).map((i) => [i.id, i]),
  );
  const wcId = inventory.workingCopyId!;
  const revId = inventory.sourceRevisionId;

  let missingInventoryItemId = 0;
  let invalidInventoryItemId = 0;
  let wcMismatch = 0;
  let revMismatch = 0;
  let pathMismatch = 0;
  let includedPathMismatch = 0;
  const includedPathSet = new Set(includedItems.map((i) => i.relativePath.replace(/\\/g, "/")));

  for (const chunk of chunks) {
    const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
    const invItemId = typeof meta.inventoryItemId === "string" ? meta.inventoryItemId : null;
    const metaWc = typeof meta.workingCopyId === "string" ? meta.workingCopyId : null;
    const metaRev = typeof meta.sourceRevisionId === "string" ? meta.sourceRevisionId : null;
    const sourcePath =
      typeof meta.sourcePath === "string" ? meta.sourcePath.replace(/\\/g, "/") : null;

    if (!invItemId) {
      missingInventoryItemId += 1;
      continue;
    }
    const item = itemById.get(invItemId);
    if (!item || item.decision !== "INCLUDED") {
      invalidInventoryItemId += 1;
    } else if (sourcePath && item.relativePath.replace(/\\/g, "/") !== sourcePath) {
      pathMismatch += 1;
    }
    if (metaWc && metaWc !== wcId) wcMismatch += 1;
    if (metaRev && revId && metaRev !== revId) revMismatch += 1;
    if (sourcePath && !includedPathSet.has(sourcePath)) includedPathMismatch += 1;
  }

  report.provenance = {
    chunkCount: chunks.length,
    missingInventoryItemId,
    invalidInventoryItemId,
    wcMismatch,
    revMismatch,
    pathMismatch,
    includedPathMismatch,
    inventoryId: inventory.id,
    workingCopyId: wcId,
    sourceRevisionId: revId,
  };
  console.log("  provenance", report.provenance);

  console.log("[9] quality / outcome");
  const qualityRuns = await prisma.pipelineRun.findMany({
    where: {
      packId,
      createdAt: { gte: new Date(startedAt - 60_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, triggerType: true, status: true, summary: true, createdAt: true },
  });
  report.recentPipelineRuns = qualityRuns;

  // Attempt to read latest quality-related reports if models exist
  let hasBlockers = false;
  let hasWarnings = false;
  let failCount = 0;
  try {
    const structure = await prisma.structureCoverageReport.findFirst({
      where: { versionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });
    const kq = await prisma.knowledgeQualityReport.findFirst({
      where: { versionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });
    const cq = await prisma.chunkQualityReport.findFirst({
      where: { versionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });
    report.qualityReports = { structure, knowledgeQuality: kq, chunkQuality: cq };
    for (const r of [structure, kq, cq]) {
      if (!r) continue;
      if (r.status === "FAIL") {
        failCount += 1;
        hasBlockers = true;
      }
      if (r.status === "WARNING") hasWarnings = true;
    }
  } catch (e) {
    report.qualityReportError = e instanceof Error ? e.message : String(e);
  }

  const qualityCompleted = Boolean(
    report.qualityReports &&
      (report.qualityReports as { structure?: unknown }).structure,
  );
  const outcome = resolveGenerationOutcome({
    workerZipPhase: "COMPLETED",
    qualityCompleted,
    hasBlockers,
    failCount,
    hasWarnings,
  });
  report.generationOutcome = outcome;
  report.serviceValidationAllowed =
    outcome === "SUCCEEDED" || outcome === "SUCCEEDED_WITH_WARNINGS";

  // Auto quality evidence: no QUALITY_REFRESH_FAILED warning + quality reports exist after gen
  const qualityAutoFailed = genResult.warnings.some((w) => w.code === "QUALITY_REFRESH_FAILED");
  report.autoQuality = {
    executedWithoutManualCta: !qualityAutoFailed && qualityCompleted,
    qualityRefreshFailedWarning: qualityAutoFailed,
    qualityCompleted,
  };

  report.elapsedMs = Date.now() - startedAt;
  report.passGates = {
    currentWorkingCopyIdSet: Boolean(versionRow.currentWorkingCopyId),
    inventoryWcBound: inventory.workingCopyId === versionRow.currentWorkingCopyId,
    finalized: inventory.status === "FINALIZED",
    generationOk: genResult.ok && genResult.generationReady,
    provenanceClean:
      missingInventoryItemId === 0 &&
      invalidInventoryItemId === 0 &&
      wcMismatch === 0 &&
      revMismatch === 0 &&
      pathMismatch === 0,
    autoQuality: Boolean(
      (report.autoQuality as { executedWithoutManualCta?: boolean } | undefined)
        ?.executedWithoutManualCta,
    ),
  };
  const allPass = Object.values(report.passGates as Record<string, boolean>).every(Boolean);
  report.verdict = allPass ? "P4 REAL ZIP E2E PASSED" : "P4.3.1 E2E HARDENING REQUIRED";

  writeFileSync(path.join(OUT_DIR, "e2e-report.json"), JSON.stringify(report, null, 2));
  console.log("[done]", report.verdict);
  console.log("report:", path.join(OUT_DIR, "e2e-report.json"));
  if (!allPass) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      path.join(OUT_DIR, "e2e-error.json"),
      JSON.stringify({ error: String(err), stack: err instanceof Error ? err.stack : null }, null, 2),
    );
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
