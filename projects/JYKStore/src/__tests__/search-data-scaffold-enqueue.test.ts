import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { reserveSplitSuffixTokens } from "../lib/docling-knowledge/docling-nd-knowledge-builder.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("search-data scaffold enqueue branching", () => {
  const service = readFileSync(
    join(root, "src/lib/search-data/search-data-generation-service.ts"),
    "utf8",
  );
  const enqueueSlice = service.slice(
    service.indexOf("export async function startSearchDataGeneration"),
    service.indexOf("export type ClaimedSearchDataGeneration"),
  );

  it("treats PENDING attempt=0 as scaffold enqueue, not already_running", () => {
    assert.match(enqueueSlice, /isActivelyRunning/);
    assert.match(enqueueSlice, /locked\.status === "PENDING" && locked\.attempt > 0/);
    assert.match(enqueueSlice, /attempt:\s*0/);
    assert.match(enqueueSlice, /attempt:\s*1/);
    assert.match(enqueueSlice, /scaffoldReused:\s*true/);
    assert.doesNotMatch(
      enqueueSlice,
      /\["PENDING",\s*"EMBEDDING"\]\.includes\(locked\.status\)/,
    );
  });

  it("keeps claim gated on attempt > 0", () => {
    const claimSlice = service.slice(
      service.indexOf("export async function claimNextSearchDataGeneration"),
      service.indexOf("export async function processSearchDataGenerationJob"),
    );
    assert.match(claimSlice, /j\.attempt > 0/);
  });

  it("checks SEARCH_DATA_RECOVERY_CONFLICT before markSearchGenerationFailed", () => {
    const recoverSlice = service.slice(
      service.indexOf("export async function recoverOneStaleSearchDataGeneration"),
      service.indexOf("export async function claimNextSearchDataGeneration"),
    );
    const conflictIdx = recoverSlice.indexOf('SEARCH_DATA_RECOVERY_CONFLICT');
    const failIdx = recoverSlice.lastIndexOf("markSearchGenerationFailed");
    // catch block: conflict check must appear before fail marking
    const catchIdx = recoverSlice.lastIndexOf("} catch (error)");
    const catchBody = recoverSlice.slice(catchIdx);
    const conflictInCatch = catchBody.indexOf("SEARCH_DATA_RECOVERY_CONFLICT");
    const failInCatch = catchBody.indexOf("markSearchGenerationFailed");
    assert.ok(conflictInCatch >= 0 && failInCatch >= 0);
    assert.ok(conflictInCatch < failInCatch, "conflict must be handled before FAILED marking");
    assert.ok(conflictIdx >= 0 && failIdx >= 0);
  });
});

describe("structure-complete CTA", () => {
  const tab = readFileSync(
    join(root, "src/components/provider-distribution/ProviderKnowledgeGenerationTab.tsx"),
    "utf8",
  );
  const pipeline = readFileSync(
    join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
    "utf8",
  );

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
      /structurePassed && !searchFoundationPassed/,
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
