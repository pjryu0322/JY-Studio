/**
 * P12.2/P12.4 — Facts Loader → Snapshot integration + MEASURED Prisma query counts.
 * JYKSTORE_DB_TESTS=1 forbids skip (CI).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PackStatus, PrismaClient } from "@prisma/client";
import { batchLoadPackWorkflowFacts, loadPackWorkflowFacts } from "../lib/workflow/pack-workflow-facts-loader.ts";
import { buildPackWorkflowSnapshot } from "../lib/workflow/pack-workflow-snapshot.ts";
import { createCountingPrisma } from "../lib/workflow/prisma-query-counter.ts";
import { requirePostgres } from "./helpers/db-gate.ts";

async function requireDb(t: { skip: (msg?: string) => void }): Promise<PrismaClient | null> {
  return requirePostgres(t);
}

describe("P12.2 PackWorkflowFacts loader DB integration", () => {
  const createdPackIds: string[] = [];
  let rootClient: PrismaClient | null = null;

  after(async () => {
    if (!rootClient) return;
    for (const packId of createdPackIds) {
      await rootClient.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
    }
    await rootClient.$disconnect().catch(() => undefined);
  });

  it("loads typed Facts → Snapshot for a seeded DRAFT pack", async (t) => {
    rootClient = await requireDb(t);
    if (!rootClient) return;

    const suffix = randomUUID().slice(0, 8);
    const packId = `p122-facts-${suffix}`;
    createdPackIds.push(packId);

    const category =
      (await rootClient.packCategory.findFirst({ select: { categoryId: true } })) ??
      (await rootClient.packCategory.create({
        data: {
          categoryId: `p122-cat-${suffix}`,
          name: "P122",
          description: "t",
          icon: "book",
        },
      }));

    await rootClient.knowledgePack.create({
      data: {
        packId,
        name: `P122 ${suffix}`,
        status: PackStatus.DRAFT,
        categoryId: category.categoryId,
        providerName: "P122 Provider",
        providerType: "COMMUNITY",
        shortDescription: "p122",
        description: "p122",
        pricing: "FREE",
        icon: "book",
        tags: [],
      },
    });

    await rootClient.pipelineRun.create({
      data: {
        packId,
        triggerType: "WORKER_ZIP_REQUEST",
        status: "PENDING",
        summary: "p122-request",
      },
    });

    const facts = await loadPackWorkflowFacts(packId, rootClient);
    assert.ok(facts);
    assert.equal(facts.packId, packId);
    assert.equal(facts.packStatus, PackStatus.DRAFT);
    assert.equal(facts.receipt.workerZipPhase, "REQUESTED");

    const snap = buildPackWorkflowSnapshot(facts);
    assert.equal(snap.currentStep, "receipt");
    assert.ok(snap.availableActions.includes("ACCEPT_MATERIAL"));
    assert.equal(snap.receipt.state, "IN_PROGRESS");
  });

  it("MEASURED: batchLoadPackWorkflowFacts query count << N× single loads", async (t) => {
    rootClient = rootClient ?? (await requireDb(t));
    if (!rootClient) return;

    const suffix = randomUUID().slice(0, 8);
    const packIds: string[] = [];
    const category =
      (await rootClient.packCategory.findFirst({ select: { categoryId: true } })) ??
      (await rootClient.packCategory.create({
        data: {
          categoryId: `p122-q-cat-${suffix}`,
          name: "P122Q",
          description: "t",
          icon: "book",
        },
      }));

    for (let i = 0; i < 3; i += 1) {
      const packId = `p122-q-${suffix}-${i}`;
      packIds.push(packId);
      createdPackIds.push(packId);
      await rootClient.knowledgePack.create({
        data: {
          packId,
          name: `P122Q ${i}`,
          status: PackStatus.DRAFT,
          categoryId: category.categoryId,
          providerName: "P122 Provider",
          providerType: "COMMUNITY",
          shortDescription: "p122q",
          description: "p122q",
          pricing: "FREE",
          icon: "book",
          tags: [],
        },
      });
      await rootClient.pipelineRun.create({
        data: {
          packId,
          triggerType: "WORKER_ZIP_REQUEST",
          status: "PENDING",
          summary: "p122q",
        },
      });
    }

    const beforeCounter = createCountingPrisma(rootClient);
    beforeCounter.reset();
    for (const id of packIds) {
      await loadPackWorkflowFacts(id, beforeCounter.client);
    }
    const before = beforeCounter.snapshot();

    const afterCounter = createCountingPrisma(rootClient);
    afterCounter.reset();
    await batchLoadPackWorkflowFacts(packIds, afterCounter.client);
    const after = afterCounter.snapshot();

    assert.ok(
      after.total < before.total,
      `expected batch (${after.total}) < N×single (${before.total})`,
    );
    assert.ok(after.total <= 20, `batch query budget exceeded: ${after.total}`);

    // Surface MEASURED numbers for evidence report scraping.
    console.log(
      JSON.stringify({
        p122QueryCount: {
          packCount: packIds.length,
          beforeNPlusOneStyle: before.total,
          afterBatch: after.total,
          beforeByModel: before.byModel,
          afterByModel: after.byModel,
        },
      }),
    );
  });
});
