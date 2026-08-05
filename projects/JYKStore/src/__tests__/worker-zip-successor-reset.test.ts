import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resetWorkerZipSuccessorStateAfterGeneration } from "../lib/python-worker/worker-zip-successor-reset.ts";
import { WORKER_ZIP_SOURCE_LEGACY_TYPE } from "../lib/python-worker/worker-source-document-service.ts";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
} from "../lib/store-workflow-markers.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("resetWorkerZipSuccessorStateAfterGeneration", () => {
  it("resets source validation, deletes quality rows, invalidates SV, retires markers", async () => {
    const calls: { model: string; op: string; where?: unknown; data?: unknown }[] = [];

    const client = {
      sourceDocument: {
        updateMany: async ({ where, data }: { where: unknown; data: unknown }) => {
          calls.push({ model: "sourceDocument", op: "updateMany", where, data });
          return { count: where && typeof where === "object" && "validationStatus" in (where as object) ? 2 : 5 };
        },
      },
      sourceValidationReport: {
        deleteMany: async ({ where }: { where: unknown }) => {
          calls.push({ model: "sourceValidationReport", op: "deleteMany", where });
          return { count: 3 };
        },
      },
      structureCoverageReport: {
        deleteMany: async ({ where }: { where: unknown }) => {
          calls.push({ model: "structureCoverageReport", op: "deleteMany", where });
          return { count: 1 };
        },
      },
      knowledgeQualityReport: {
        deleteMany: async ({ where }: { where: unknown }) => {
          calls.push({ model: "knowledgeQualityReport", op: "deleteMany", where });
          return { count: 1 };
        },
      },
      chunkQualityReport: {
        deleteMany: async ({ where }: { where: unknown }) => {
          calls.push({ model: "chunkQualityReport", op: "deleteMany", where });
          return { count: 1 };
        },
      },
      releaseGateRun: {
        deleteMany: async ({ where }: { where: unknown }) => {
          calls.push({ model: "releaseGateRun", op: "deleteMany", where });
          return { count: 1 };
        },
      },
      retrievalEvaluationSet: {
        deleteMany: async ({ where }: { where: unknown }) => {
          calls.push({ model: "retrievalEvaluationSet", op: "deleteMany", where });
          return { count: 1 };
        },
      },
      serviceValidationRun: {
        updateMany: async ({ where, data }: { where: unknown; data: unknown }) => {
          calls.push({ model: "serviceValidationRun", op: "updateMany", where, data });
          return { count: 2 };
        },
      },
      pipelineRun: {
        updateMany: async ({ where, data }: { where: unknown; data: unknown }) => {
          calls.push({ model: "pipelineRun", op: "updateMany", where, data });
          return { count: 1 };
        },
      },
    };

    const result = await resetWorkerZipSuccessorStateAfterGeneration({
      packId: "packA",
      versionId: "verA",
      prismaClient: client as never,
    });

    assert.equal(result.sourceDocumentsReset, 2);
    assert.equal(result.sourceValidationReportsDeleted, 3);
    assert.equal(result.structureCoverageReportsDeleted, 1);
    assert.equal(result.knowledgeQualityReportsDeleted, 1);
    assert.equal(result.chunkQualityReportsDeleted, 1);
    assert.equal(result.releaseGateRunsDeleted, 1);
    assert.equal(result.retrievalEvaluationSetsDeleted, 1);
    assert.equal(result.serviceValidationsInvalidated, 2);
    assert.equal(result.providerReviewMarkersRetired, 1);
    assert.equal(result.serviceValidationMarkersRetired, 1);

    const sourceReset = calls.find(
      (c) =>
        c.model === "sourceDocument" &&
        c.op === "updateMany" &&
        (c.data as { validationStatus?: string })?.validationStatus === "NOT_CHECKED",
    );
    assert.ok(sourceReset);
    assert.equal(
      (sourceReset!.where as { legacySourceType: string }).legacySourceType,
      WORKER_ZIP_SOURCE_LEGACY_TYPE,
    );

    for (const model of [
      "sourceValidationReport",
      "structureCoverageReport",
      "knowledgeQualityReport",
      "chunkQualityReport",
      "releaseGateRun",
      "retrievalEvaluationSet",
    ]) {
      const del = calls.find((c) => c.model === model && c.op === "deleteMany");
      assert.ok(del, `expected deleteMany on ${model}`);
      assert.deepEqual(del!.where, { packId: "packA" });
    }

    const providerRetire = calls.find(
      (c) =>
        c.model === "pipelineRun" &&
        (c.where as { triggerType?: string })?.triggerType === STORE_PROVIDER_REVIEW_TRIGGER,
    );
    assert.ok(providerRetire);
    assert.equal((providerRetire!.data as { status: string }).status, "FAIL");

    const svRetire = calls.find(
      (c) =>
        c.model === "pipelineRun" &&
        (c.where as { triggerType?: string })?.triggerType === STORE_SERVICE_VALIDATION_TRIGGER,
    );
    assert.ok(svRetire);
    assert.equal((svRetire!.data as { status: string }).status, "FAIL");
  });

  it("is invoked from runProviderWorkerZipImport after READY", () => {
    const src = readFileSync(
      path.join(root, "src/lib/python-worker/worker-zip/import-run/finalize-import.ts"),
      "utf8",
    );
    assert.match(src, /resetWorkerZipSuccessorStateAfterGeneration/);
    assert.match(src, /resetSuccessorState/);
    assert.match(src, /Knowledge data changed/);
  });
});
