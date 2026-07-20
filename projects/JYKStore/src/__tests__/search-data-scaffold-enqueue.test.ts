import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { reserveSplitSuffixTokens } from "../lib/docling-knowledge/docling-nd-knowledge-builder.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const searchDataDir = join(root, "src/lib/search-data");

function readSearchDataModule(name: string): string {
  return readFileSync(join(searchDataDir, name), "utf8");
}

describe("search-data scaffold enqueue branching", () => {
  const enqueueSlice = [
    readSearchDataModule("search-data-generation-enqueue.ts"),
    readSearchDataModule("search-data-generation-enqueue-tx.ts"),
    readSearchDataModule("search-data-generation-enqueue-tx-policy.ts"),
    readSearchDataModule("search-data-generation-enqueue-tx-writes.ts"),
    readSearchDataModule("search-data-generation-enqueue-preflight.ts"),
    readSearchDataModule("search-data-generation-artifacts.ts"),
  ].join("\n");
  const worker = [
    readSearchDataModule("search-data-generation-worker.ts"),
    readSearchDataModule("search-data-generation-worker-recover.ts"),
    readSearchDataModule("search-data-generation-artifacts.ts"),
  ].join("\n");

  it("treats PENDING attempt=0 as scaffold enqueue, not already_running", () => {
    assert.match(enqueueSlice, /isActivelyRunningLockedGeneration/);
    assert.match(enqueueSlice, /locked\.status === "PENDING" && locked\.attempt > 0/);
    assert.match(enqueueSlice, /attempt:\s*0/);
    assert.match(enqueueSlice, /attempt:\s*1/);
    assert.match(enqueueSlice, /scaffoldReused:\s*true/);
    assert.doesNotMatch(
      enqueueSlice,
      /\["PENDING",\s*"EMBEDDING"\]\.includes\(locked\.status\)/,
    );
  });

  it("UI state distinguishes scaffold from enqueued PENDING", () => {
    const state = readFileSync(
      join(root, "src/lib/search-data/search-data-state.ts"),
      "utf8",
    );
    assert.match(state, /isScaffoldGeneration/);
    assert.match(state, /isRunningGeneration/);
    assert.doesNotMatch(state, /RUNNING_GEN/);
  });

  it("keeps claim gated on attempt > 0", () => {
    const claimSlice = worker.slice(
      worker.indexOf("export async function claimNextSearchDataGeneration"),
      worker.indexOf("export async function processSearchDataGenerationJob"),
    );
    assert.match(claimSlice, /j\.attempt > 0/);
  });

  it("checks SEARCH_DATA_RECOVERY_CONFLICT before markSearchDataGenerationFailed", () => {
    const recoverOrchestration = worker.slice(
      worker.indexOf("export async function recoverOneStaleSearchDataGeneration"),
      worker.indexOf("export async function claimNextSearchDataGeneration"),
    );
    const catchIdx = recoverOrchestration.lastIndexOf("} catch (error)");
    const catchBody = recoverOrchestration.slice(catchIdx);
    const conflictInCatch = catchBody.indexOf("isRecoveryConflictError");
    const failInCatch = catchBody.indexOf("markSearchDataGenerationFailed");
    assert.ok(conflictInCatch >= 0 && failInCatch >= 0);
    assert.ok(conflictInCatch < failInCatch, "conflict must be handled before FAILED marking");
    assert.match(worker, /SEARCH_DATA_RECOVERY_CONFLICT|SEARCH_DATA_FAILURE\.RECOVERY_FAILED/);
  });
});

describe("structure-complete CTA", () => {
  const tab = readFileSync(
    join(root, "src/components/provider-distribution/ProviderKnowledgeGenerationTab.tsx"),
    "utf8",
  );
  const pipeline = [
    readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
      "utf8",
    ),
    readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-status-policy.ts"),
      "utf8",
    ),
  ].join("\n");

  it("hides start button when structure is complete", () => {
    assert.match(tab, /primary === "start" && !structureComplete/);
    assert.match(tab, /검색데이터 생성·검증으로 이동/);
    assert.match(tab, /데이터 구조화 다시 실행/);
    assert.match(tab, /window\.confirm/);
  });

  it("sets primaryCta to search_validation after structure PASS", () => {
    assert.match(pipeline, /search_validation/);
    assert.match(
      pipeline,
      /structurePassed && !(?:input\.)?searchFoundationPassed/,
    );
  });
});

describe("resplit provenance helpers", () => {
  it("reserves multi-digit title suffix for token budget", () => {
    const budgeted = reserveSplitSuffixTokens("제목", { maxDigits: 4 });
    assert.match(budgeted, /\(9999\)$/);
  });

  it("fallback resplit uses primaryContent and absolute sourceTextStart", () => {
    const builder = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-nd-knowledge-builder.ts"),
      "utf8",
    );
    assert.match(builder, /primaryContent/);
    assert.match(builder, /sourceTextStart:\s*absolutePrimaryStart/);
    assert.match(builder, /contentKind === "TABLE"/);
    assert.match(builder, /splitTableRowsByTokens/);
    assert.match(builder, /MAX_RESPLIT_DEPTH/);
    assert.match(builder, /CHUNK_TOKEN_RESPLIT_EXHAUSTED/);
    assert.match(builder, /validateChunkProvenanceBeforeSave/);
    assert.doesNotMatch(builder, /shrunk\[0\]/);
  });
});
