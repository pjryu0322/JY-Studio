/**
 * P12.4 — Worker ZIP request marker lifecycle (DB-only; no Object Storage / Python Worker).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PackStatus, PrismaClient } from "@prisma/client";
import {
  WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
  WORKER_ZIP_REQUEST_TRIGGER,
} from "../lib/python-worker/worker-zip-import-provider-service.ts";
import { requirePostgres } from "./helpers/db-gate.ts";

describe("P12.4 Worker ZIP lifecycle DB orchestration", () => {
  const createdPackIds: string[] = [];
  let root: PrismaClient | null = null;

  after(async () => {
    if (!root) return;
    for (const packId of createdPackIds) {
      await root.pipelineRun.deleteMany({ where: { packId } }).catch(() => undefined);
      await root.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
    }
    await root.$disconnect().catch(() => undefined);
  });

  it("PENDING request → ACCEPTED marker transition on DRAFT pack", async (t) => {
    root = await requirePostgres(t);
    if (!root) return;

    const suffix = randomUUID().slice(0, 8);
    const packId = `p124-zip-${suffix}`;
    createdPackIds.push(packId);

    const category =
      (await root.packCategory.findFirst({ select: { categoryId: true } })) ??
      (await root.packCategory.create({
        data: {
          categoryId: `p124-zip-cat-${suffix}`,
          name: "P124Zip",
          description: "t",
          icon: "book",
        },
      }));

    await root.knowledgePack.create({
      data: {
        packId,
        name: `P124 Zip ${suffix}`,
        status: PackStatus.DRAFT,
        categoryId: category.categoryId,
        providerName: "P124 Provider",
        providerType: "COMMUNITY",
        shortDescription: "p124",
        description: "p124",
        pricing: "FREE",
        icon: "book",
        tags: [],
      },
    });

    const pending = await root.pipelineRun.create({
      data: {
        packId,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: "PENDING",
        summary: "p124-provider-submit",
      },
    });
    assert.equal(pending.status, "PENDING");

    const accepted = await root.pipelineRun.update({
      where: { id: pending.id },
      data: {
        status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
        summary: "p124-admin-accept",
      },
    });
    assert.equal(accepted.status, WORKER_ZIP_REQUEST_ACCEPTED_STATUS);

    const open = await root.pipelineRun.findFirst({
      where: {
        packId,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
      },
    });
    assert.ok(open);
    assert.equal(open.id, pending.id);
  });
});
