import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDoclingRetrievalEvalCases,
  DOCLING_RETRIEVAL_PASS_THRESHOLDS,
  DOCLING_RETRIEVAL_WARNING_OPENS_DISTRIBUTION,
} from "../lib/docling-knowledge/docling-knowledge-eval.ts";
import {
  createKnowledgeRunBinding,
  parseKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
  isKnowledgeRunHeartbeatStale,
} from "../lib/docling-knowledge/docling-knowledge-run-binding.ts";
import {
  extractFullTableRows,
  splitSectionIntoUnitTexts,
} from "../lib/docling-knowledge/docling-nd-knowledge-builder.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("docling knowledge pipeline hardening", () => {
  it("splits long section text structurally instead of discarding the tail", () => {
    const long = Array.from({ length: 40 }, (_, i) => `단락 ${i}: ${"내용".repeat(80)}`).join(
      "\n\n",
    );
    assert.ok(long.length > 6000);
    const parts = splitSectionIntoUnitTexts(long, 6000);
    assert.ok(parts.length > 1);
    const joinedLen = parts.reduce((a, b) => a + b.text.length, 0);
    // Allow small whitespace normalization loss, but not wholesale truncate.
    assert.ok(joinedLen >= long.length * 0.95);
    assert.ok(parts.every((p) => typeof p.startOffset === "number"));
    assert.ok(parts[0]!.startOffset === 0 || parts[0]!.startOffset >= 0);
    assert.ok(parts.some((p) => p.startOffset > 0));
  });

  it("extracts full table rows from cells, not only previewRows", () => {
    const cells = [];
    for (let r = 0; r < 25; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        cells.push({
          row: r,
          column: c,
          text: r === 0 ? `H${c}` : `R${r}C${c}`,
          isColumnHeader: r === 0,
        });
      }
    }
    const extracted = extractFullTableRows({
      rowCount: 25,
      columnCount: 3,
      cells,
      previewRows: [
        ["H0", "H1", "H2"],
        ["only", "preview", "row"],
      ],
    });
    assert.equal(extracted.headers.join("|"), "H0|H1|H2");
    assert.equal(extracted.rows.length, 24);
    assert.ok(extracted.rows[23]?.[0]?.includes("R24"));
  });

  it("round-trips knowledge run binding JSON used for durable jobs", () => {
    const binding = createKnowledgeRunBinding({
      versionId: "ver1",
      normalizedDocumentId: "nd1",
      fingerprint: "fp1",
      bundleId: "b1",
      indexGenerationId: "gen1",
      requestedByUserId: "u1",
      requestedByClientId: "c1",
    });
    const parsed = parseKnowledgeRunBinding(serializeKnowledgeRunBinding(binding));
    assert.ok(parsed);
    assert.equal(parsed!.fingerprint, "fp1");
    assert.equal(parsed!.indexGenerationId, "gen1");
    assert.equal(isKnowledgeRunHeartbeatStale(parsed!, Date.now()), false);
    assert.equal(
      isKnowledgeRunHeartbeatStale(
        { ...parsed!, heartbeatAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
        Date.now(),
      ),
      true,
    );
  });

  it("builds eval cases from chunk content rather than title smoke only", () => {
    const cases = buildDoclingRetrievalEvalCases([
      {
        id: "c1",
        title: "설치 가이드",
        content: "경로: 설치\n\n데이터베이스를 먼저 구성한 뒤 서비스를 시작합니다.",
        section: "설치",
        tags: ["docling", "기능 설명"],
        sourceDocumentId: "src1",
        metadata: {
          knowledgeUnitId: "u1",
          page: 3,
          pageStart: 3,
          fingerprint: "fp",
          normalizedDocumentId: "nd",
          pipelineRunId: "run",
          indexGenerationId: "gen",
        },
      },
      {
        id: "c2",
        title: "오류 표",
        content: "표 캡션: 오류 표\n\n컬럼: 코드 | 설명\n\nE1 | 실패",
        section: "tables",
        tags: ["docling", "표 기반 정보"],
        sourceDocumentId: "src1",
        metadata: {
          knowledgeUnitId: "u2",
          page: 4,
          fingerprint: "fp",
          normalizedDocumentId: "nd",
          pipelineRunId: "run",
          indexGenerationId: "gen",
        },
      },
    ]);
    assert.ok(cases.length >= 2);
    assert.ok(cases.some((c) => c.query.includes("데이터베이스") || c.query.includes("설치")));
    assert.ok(cases.some((c) => c.questionType === "표"));
    assert.ok(cases.every((c) => c.expectedChunkIds.length > 0));
  });

  it("keeps PASS thresholds strict and WARNING does not open distribution", () => {
    assert.equal(DOCLING_RETRIEVAL_PASS_THRESHOLDS.recallAt5, 0.8);
    assert.equal(DOCLING_RETRIEVAL_PASS_THRESHOLDS.hitAt3, 0.75);
    assert.equal(DOCLING_RETRIEVAL_WARNING_OPENS_DISTRIBUTION, false);
  });

  it("uses durable PENDING job + worker claim instead of void execute", () => {
    const root = join(import.meta.dirname, "../..");
    const service = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
      "utf8",
    );
    const route = readFileSync(
      join(root, "src/app/api/v1/provider/packs/[packId]/knowledge-pipeline/route.ts"),
      "utf8",
    );
    const worker = readFileSync(
      join(root, "src/workers/docling-processing-worker.ts"),
      "utf8",
    );
    const claim = readFileSync(
      join(root, "src/workers/knowledge-pipeline-job-claim.ts"),
      "utf8",
    );
    assert.ok(!service.includes("void executeDoclingKnowledgePipeline"));
    assert.ok(service.includes('status: "PENDING"'));
    assert.ok(service.includes("pg_advisory_xact_lock"));
    assert.ok(route.includes("status: 202"));
    assert.ok(worker.includes("runKnowledgePipelineWorkerOnce"));
    assert.ok(claim.includes("claimNextKnowledgePipelineRun"));
  });

  it("pipeline step timing leaves finishedAt null while RUNNING", () => {
    const root = join(import.meta.dirname, "../..");
    const pipeline = readFileSync(join(root, "src/lib/pipeline-service.ts"), "utf8");
    assert.ok(pipeline.includes("const finishedAt = isTerminal ? now : null"));
    assert.ok(pipeline.includes('input.status === "SKIPPED"'));
  });

  it("isDoclingKnowledgePipelinePassed does not trust pack pipelineStatus alone", () => {
    const root = join(import.meta.dirname, "../..");
    const service = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
      "utf8",
    );
    const fnStart = service.indexOf("export async function isDoclingKnowledgePipelinePassed");
    const fnBody = service.slice(fnStart, fnStart + 1800);
    assert.ok(fnBody.includes("fingerprint"));
    assert.ok(fnBody.includes("normalizedDocumentId") || fnBody.includes("bindingMatchesActive"));
    assert.ok(!fnBody.includes('pipelineStatus === "READY_FOR_REVIEW"'));
    assert.ok(!fnBody.includes('pipelineStatus === "PUBLISHED"'));
  });

  it("builder no longer clamps unit text before split with MAX_UNIT_CHARS discard", () => {
    const root = join(import.meta.dirname, "../..");
    const builder = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-nd-knowledge-builder.ts"),
      "utf8",
    );
    assert.ok(builder.includes("splitSectionIntoUnitTexts"));
    assert.ok(builder.includes("extractFullTableRows"));
    assert.ok(builder.includes("indexGenerationId"));
    assert.ok(builder.includes('indexScope: "DRAFT"'));
    assert.ok(!builder.includes("clamp(\n        [`경로:"));
  });
});
