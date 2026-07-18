/**
 * Unit tests for P5.1.2 approval-transaction evidence helper and
 * conditional promotion guard (no DB required).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { promoteSearchGeneration } from "../lib/search-generation/search-generation-service.ts";

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("promoteSearchGeneration conditional guard (P5.1.2)", () => {
  it("rejects promotion when descriptor guard does not match (count 0 → conflict)", async () => {
    const updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
    const fakeTx = {
      searchIndexGeneration: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id === "gen-1") {
            return {
              id: "gen-1",
              versionId: "ver-1",
              status: "READY",
              scope: "DRAFT",
              generationFingerprint: "fp-1",
              embeddingProvider: "local-e5",
              embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
              embeddingModelRevision: SHA,
              embeddingDimension: 384,
              distanceMetric: "cosine",
            };
          }
          return null;
        },
        updateMany: async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          updates.push(args);
          // Retire previous production
          if (args.where.scope === "PRODUCTION") {
            return { count: 0 };
          }
          // Conditional promote: simulate revision drift → 0 rows
          if (
            args.where.embeddingModelRevision &&
            args.where.embeddingModelRevision !== SHA
          ) {
            return { count: 0 };
          }
          if (args.data.status === "PROMOTED") {
            // Guard matches in this branch only when revision equals SHA
            if (args.where.embeddingModelRevision === SHA) {
              return { count: 1 };
            }
            return { count: 0 };
          }
          return { count: 0 };
        },
      },
    };

    await assert.rejects(
      () =>
        promoteSearchGeneration("gen-1", fakeTx as never, {
          generationFingerprint: "fp-1",
          embeddingProvider: "local-e5",
          embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
          embeddingModelRevision: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          embeddingDimension: 384,
          distanceMetric: "cosine",
        }),
      (error: unknown) =>
        error instanceof PayloadServiceError &&
        error.code === "SEARCH_GENERATION_TRANSITION_CONFLICT",
    );

    // Retire was attempted before the failed promote (same logical tx from caller's view).
    assert.ok(updates.some((u) => u.where.scope === "PRODUCTION"));
    assert.ok(updates.some((u) => u.data.status === "PROMOTED"));
  });

  it("includes Snapshot descriptor fields in the conditional promote where-clause", async () => {
    let promoteWhere: Record<string, unknown> | null = null;
    const fakeTx = {
      searchIndexGeneration: {
        findUnique: async () => ({
          id: "gen-1",
          versionId: "ver-1",
          status: "READY",
          scope: "DRAFT",
          generationFingerprint: "fp-1",
          embeddingProvider: "local-e5",
          embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
          embeddingModelRevision: SHA,
          embeddingDimension: 384,
          distanceMetric: "cosine",
        }),
        updateMany: async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          if (args.data.status === "PROMOTED") {
            promoteWhere = args.where;
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
    };

    const result = await promoteSearchGeneration("gen-1", fakeTx as never, {
      generationFingerprint: "fp-1",
      embeddingProvider: "local-e5",
      embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
      embeddingModelRevision: SHA,
      embeddingDimension: 384,
      distanceMetric: "cosine",
    });

    assert.equal(result.id, "gen-1");
    assert.ok(promoteWhere);
    assert.equal(promoteWhere!.status, "READY");
    assert.equal(promoteWhere!.scope, "DRAFT");
    assert.equal(promoteWhere!.generationFingerprint, "fp-1");
    assert.equal(promoteWhere!.embeddingProvider, "local-e5");
    assert.equal(promoteWhere!.embeddingModelRevision, SHA);
    assert.equal(promoteWhere!.embeddingDimension, 384);
    assert.equal(promoteWhere!.distanceMetric, "cosine");
  });
});

describe("approval evidence helper exports (P5.1.2)", () => {
  it("exports assertApprovalSearchGenerationInTx without requiring external snapshot", async () => {
    const mod = await import("../lib/distribution/approval-search-generation-evidence.ts");
    assert.equal(typeof mod.assertApprovalSearchGenerationInTx, "function");
    // Arity 2: (tx, { packId, reviewId }) — no snapshot parameter.
    assert.equal(mod.assertApprovalSearchGenerationInTx.length, 2);
  });

  it("registers transition conflict error codes", async () => {
    const { PayloadServiceError: Err } = await import(
      "../lib/distribution/payload-errors.ts"
    );
    const approval = new Err("APPROVAL_TRANSITION_CONFLICT", "승인 충돌", 409);
    const review = new Err("REVIEW_TRANSITION_CONFLICT", "반려 충돌", 409);
    const snap = new Err("APPROVAL_SNAPSHOT_MISMATCH", "스냅샷", 409);
    assert.equal(approval.code, "APPROVAL_TRANSITION_CONFLICT");
    assert.equal(review.code, "REVIEW_TRANSITION_CONFLICT");
    assert.equal(snap.code, "APPROVAL_SNAPSHOT_MISMATCH");
    assert.equal(approval.httpStatus, 409);
  });
});
