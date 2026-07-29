import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assessWorkerCapability,
  isKnowledgeEligibleForInclude,
  WORKER_CAPABILITY_POLICY_VERSION,
} from "@/lib/python-worker/worker-capability-policy";
import { classifyInventoryAutoDecision } from "@/lib/knowledge-scope/inventory-auto-exclude";
import {
  assertIncludedItemsMatchWorkerCapability,
} from "@/lib/knowledge-scope/inventory-worker-manifest";
import { KnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-types";
import { CANONICAL_CHUNK_POLICY } from "@/lib/python-worker/chunk-policy";
import { E5_MAX_SEQUENCE_TOKENS, E5_TARGET_PASSAGE_TOKENS } from "@/lib/embedding/e5-embedding-constants";
import {
  assertWorkerChunkProvenance,
  WorkerOutputDbImportError,
} from "@/lib/python-worker/worker-output-db-import-service";
import {
  categorizeWorkerProblemCode,
  isGenerationProblemCategory,
  isSourceProblemCategory,
} from "@/lib/python-worker/worker-problem-taxonomy";
import { resolveGenerationOutcome } from "@/lib/workflow/generation-outcome";

describe("P4.2 worker capability SoT", () => {
  it("PDF and docs API HTML are knowledge-eligible", () => {
    const pdf = assessWorkerCapability({
      relativePath: "docs/manual.pdf",
      fileName: "manual.pdf",
      extension: ".pdf",
    });
    assert.equal(pdf.capability, "SUPPORTED");
    assert.equal(isKnowledgeEligibleForInclude(pdf), true);

    const html = assessWorkerCapability({
      relativePath: "docs/api/Grid.html",
      fileName: "Grid.html",
      extension: ".html",
    });
    assert.equal(html.capability, "SUPPORTED");
    assert.equal(html.parser, "html_api");
    assert.equal(isKnowledgeEligibleForInclude(html), true);
  });

  it("zero-byte and executables are system excluded", () => {
    const zero = classifyInventoryAutoDecision({
      relativePath: "empty.pdf",
      fileName: "empty.pdf",
      extension: ".pdf",
      sizeBytes: 0,
    });
    assert.equal(zero.decision, "EXCLUDED");
    assert.equal(zero.exclusionReasonCode, "ZERO_BYTE");
    assert.equal(zero.overrideAllowed, false);

    const exe = classifyInventoryAutoDecision({
      relativePath: "setup.exe",
      fileName: "setup.exe",
      extension: ".exe",
      sizeBytes: 10,
    });
    assert.equal(exe.decision, "EXCLUDED");
    assert.equal(exe.exclusionReasonCode, "EXECUTABLE");
  });

  it("markdown without parser cannot finalize as INCLUDED", () => {
    const md = classifyInventoryAutoDecision({
      relativePath: "docs/notes.md",
      fileName: "notes.md",
      extension: ".md",
      sizeBytes: 100,
    });
    assert.equal(md.decision, "EXCLUDED");
    assert.equal(md.exclusionReasonCode, "UNSUPPORTED");
    assert.equal(md.overrideAllowed, false);

    assert.throws(
      () =>
        assertIncludedItemsMatchWorkerCapability([
          {
            id: "item1",
            relativePath: "docs/notes.md",
            decision: "INCLUDED",
            fileName: "notes.md",
            extension: ".md",
          },
        ]),
      (err: unknown) =>
        err instanceof KnowledgeScopeInventoryError &&
        err.code === "WORKER_CAPABILITY_MISMATCH",
    );
  });

  it("policy version is pinned", () => {
    assert.equal(WORKER_CAPABILITY_POLICY_VERSION, "worker-capability-v1");
  });
});

describe("P4.2 chunk policy SoT", () => {
  it("Worker JSON and Store constants share target 480 / hard max 512", () => {
    const jsonPath = path.join(
      process.cwd(),
      "python-worker",
      "config",
      "chunk_policy.json",
    );
    const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      targetPassageTokens: number;
      hardMaxTokens: number;
      policyVersion: string;
    };
    assert.equal(raw.targetPassageTokens, 480);
    assert.equal(raw.hardMaxTokens, 512);
    assert.equal(CANONICAL_CHUNK_POLICY.targetPassageTokens, raw.targetPassageTokens);
    assert.equal(CANONICAL_CHUNK_POLICY.hardMaxTokens, raw.hardMaxTokens);
    assert.equal(E5_TARGET_PASSAGE_TOKENS, 480);
    assert.equal(E5_MAX_SEQUENCE_TOKENS, 512);
    assert.equal(raw.policyVersion, CANONICAL_CHUNK_POLICY.policyVersion);
  });
});

describe("P4.2 provenance import gate", () => {
  it("rejects working copy / inventory item mismatches", () => {
    assert.throws(
      () =>
        assertWorkerChunkProvenance({
          chunks: [
            {
              chunkId: "c1",
              sourcePath: "docs/a.pdf",
              workingCopyId: "wc-other",
              inventoryItemId: "item-wrong",
            },
          ],
          expected: {
            pipelineRunId: "run1",
            workingCopyId: "wc-1",
            inventoryItemIdByPath: { "docs/a.pdf": "item-1" },
          },
        }),
      (err: unknown) =>
        err instanceof WorkerOutputDbImportError &&
        err.code === "PROVENANCE_WORKING_COPY_MISMATCH",
    );

    assert.throws(
      () =>
        assertWorkerChunkProvenance({
          chunks: [
            {
              chunkId: "c1",
              sourcePath: "docs/a.pdf",
              workingCopyId: "wc-1",
              inventoryItemId: "item-wrong",
            },
          ],
          expected: {
            pipelineRunId: "run1",
            workingCopyId: "wc-1",
            inventoryItemIdByPath: { "docs/a.pdf": "item-1" },
          },
        }),
      (err: unknown) =>
        err instanceof WorkerOutputDbImportError &&
        err.code === "PROVENANCE_INVENTORY_ITEM_MISMATCH",
    );
  });

  it("accepts matching provenance", () => {
    assert.doesNotThrow(() =>
      assertWorkerChunkProvenance({
        chunks: [
          {
            chunkId: "c1",
            sourcePath: "docs/a.pdf",
            workingCopyId: "wc-1",
            sourceRevisionId: "rev-1",
            inventoryItemId: "item-1",
          },
        ],
        expected: {
          pipelineRunId: "run1",
          workingCopyId: "wc-1",
          sourceRevisionId: "rev-1",
          inventoryItemIdByPath: { "docs/a.pdf": "item-1" },
        },
      }),
    );
  });
});

describe("P4.2 problem taxonomy + generation outcome", () => {
  it("classifies source vs generation codes", () => {
    assert.equal(categorizeWorkerProblemCode("SOURCE_CORRUPT"), "SOURCE");
    assert.equal(isSourceProblemCategory(categorizeWorkerProblemCode("WORKER_CAPABILITY_MISMATCH")), true);
    assert.equal(categorizeWorkerProblemCode("PARSE_FAILED"), "PARSER");
    assert.equal(categorizeWorkerProblemCode("QUALITY_REFRESH_FAILED"), "QUALITY");
    assert.equal(isGenerationProblemCategory(categorizeWorkerProblemCode("WORKER_RUN_FAILED")), true);
  });

  it("maps quality outcomes for service validation / correction", () => {
    assert.equal(
      resolveGenerationOutcome({
        workerZipPhase: "COMPLETED",
        qualityCompleted: true,
        hasBlockers: false,
        failCount: 0,
        hasWarnings: true,
      }),
      "SUCCEEDED_WITH_WARNINGS",
    );
    assert.equal(
      resolveGenerationOutcome({
        workerZipPhase: "COMPLETED",
        qualityCompleted: true,
        hasBlockers: true,
        failCount: 0,
        hasWarnings: false,
      }),
      "CORRECTION_REQUIRED",
    );
  });
});
