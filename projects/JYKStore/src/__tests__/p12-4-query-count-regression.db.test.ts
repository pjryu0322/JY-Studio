/**
 * P12.4 — Query-count regression: batch Facts loader must not grow linearly with N.
 * With JYKSTORE_DB_TESTS=1, skip is forbidden.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PackStatus, PrismaClient } from "@prisma/client";
import { batchLoadPackWorkflowFacts } from "../lib/workflow/pack-workflow-facts-loader.ts";
import { createCountingPrisma } from "../lib/workflow/prisma-query-counter.ts";
import { batchResolveStoreWorkflowMarkers } from "../lib/store-workflow-markers.ts";
import { requirePostgres } from "./helpers/db-gate.ts";

describe("P12.4 query count regression (N=3 vs N=100)", () => {
  const createdPackIds: string[] = [];
  let root: PrismaClient | null = null;

  after(async () => {
    if (!root) return;
    for (const packId of createdPackIds) {
      await root.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
    }
    await root.$disconnect().catch(() => undefined);
  });

  async function seedPacks(client: PrismaClient, n: number, suffix: string): Promise<string[]> {
    const category =
      (await client.packCategory.findFirst({ select: { categoryId: true } })) ??
      (await client.packCategory.create({
        data: {
          categoryId: `p124-qc-cat-${suffix}`,
          name: "P124QC",
          description: "t",
          icon: "book",
        },
      }));
    const ids: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const packId = `p124-qc-${suffix}-${i}`;
      ids.push(packId);
      createdPackIds.push(packId);
      await client.knowledgePack.create({
        data: {
          packId,
          name: `P124QC ${i}`,
          status: PackStatus.DRAFT,
          categoryId: category.categoryId,
          providerName: "P124",
          providerType: "COMMUNITY",
          shortDescription: "p124",
          description: "p124",
          pricing: "FREE",
          icon: "book",
          tags: [],
        },
      });
      await client.pipelineRun.create({
        data: {
          packId,
          triggerType: "WORKER_ZIP_REQUEST",
          status: "PENDING",
          summary: "p124qc",
        },
      });
    }
    return ids;
  }

  it("batchLoadPackWorkflowFacts: queryCount100 <= queryCount3 + 2", async (t) => {
    root = await requirePostgres(t);
    if (!root) return;

    const suffix = randomUUID().slice(0, 8);
    const ids3 = await seedPacks(root, 3, `${suffix}a`);
    const c3 = createCountingPrisma(root);
    c3.reset();
    await batchLoadPackWorkflowFacts(ids3, c3.client);
    const q3 = c3.snapshot().total;

    const ids100 = await seedPacks(root, 100, `${suffix}b`);
    const c100 = createCountingPrisma(root);
    c100.reset();
    await batchLoadPackWorkflowFacts(ids100, c100.client);
    const q100 = c100.snapshot().total;

    assert.ok(
      q100 <= q3 + 2,
      `expected q100 (${q100}) <= q3 (${q3}) + 2 (batch must not scale with N)`,
    );
    assert.ok(q3 <= 20, `Facts batch N=3 budget: got ${q3}`);
    assert.ok(q100 <= 20, `Facts batch N=100 budget: got ${q100}`);
  });

  it("batchResolveStoreWorkflowMarkers: queryCount100 <= queryCount3 + 2", async (t) => {
    root = root ?? (await requirePostgres(t));
    if (!root) return;

    const suffix = randomUUID().slice(0, 8);
    const ids3 = await seedPacks(root, 3, `${suffix}m3`);
    const c3 = createCountingPrisma(root);
    c3.reset();
    await batchResolveStoreWorkflowMarkers(ids3, c3.client as never);
    const q3 = c3.snapshot().total;

    const ids100 = await seedPacks(root, 100, `${suffix}m100`);
    const c100 = createCountingPrisma(root);
    c100.reset();
    await batchResolveStoreWorkflowMarkers(ids100, c100.client as never);
    const q100 = c100.snapshot().total;

    assert.ok(
      q100 <= q3 + 2,
      `markers: expected q100 (${q100}) <= q3 (${q3}) + 2`,
    );
    assert.ok(q3 <= 10, `Marker batch N=3 budget: got ${q3}`);
  });
});
