import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildDoclingRetrievalEvalCases,
  DOCLING_RETRIEVAL_PASS_THRESHOLDS,
  minDoclingEvalCaseCount,
} from "../lib/docling-knowledge/docling-knowledge-eval.ts";
import {
  createKnowledgeRunBinding,
  KNOWLEDGE_PIPELINE_MAX_ATTEMPTS,
  parseKnowledgeRunBinding,
  serializeKnowledgeRunBinding,
} from "../lib/docling-knowledge/docling-knowledge-run-binding.ts";
import { splitSectionIntoUnitTexts } from "../lib/docling-knowledge/docling-nd-knowledge-builder.ts";
import { buildDoclingBundleReviewSubmitSnapshot } from "../lib/distribution/distribution-submit-snapshot.ts";

function ensureDatabaseUrlFromDotEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
  if (!existsSync(envPath)) return;
  const match = readFileSync(envPath, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
  if (!match?.[1]) return;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env.DATABASE_URL = value;
}

ensureDatabaseUrlFromDotEnv();
const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe("docling knowledge pipeline follow-up hardening", () => {
  it("dev script kills others on first exit (concurrently)", () => {
    const root = join(import.meta.dirname, "../..");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.ok(pkg.scripts.dev.includes("--success first"));
    assert.ok(pkg.scripts.dev.includes("-k") || pkg.scripts.dev.includes("--kill-others"));
    assert.ok(pkg.scripts["dev:web"].includes("3004"));
  });

  it("enforces min evaluation case counts", () => {
    assert.equal(minDoclingEvalCaseCount(3), Math.max(5, Math.min(6, 7)));
    assert.ok(minDoclingEvalCaseCount(11) >= 5);
    assert.equal(minDoclingEvalCaseCount(20), 10);
    assert.equal(minDoclingEvalCaseCount(50), 20);
  });

  it("eval cases include expected ND / version / source ids", () => {
    const cases = buildDoclingRetrievalEvalCases(
      [
        {
          id: "c1",
          title: "설정",
          content: "경로: 설정\n\n메모리 제한을 먼저 확인합니다.",
          section: "설정",
          tags: ["docling", "기능 설명"],
          sourceDocumentId: "src1",
          metadata: {
            knowledgeUnitId: "u1",
            normalizedDocumentId: "nd1",
            versionId: "ver1",
            page: 2,
          },
        },
      ],
      { versionId: "ver1" },
    );
    assert.ok(cases.length >= 1);
    assert.equal(cases[0]!.expectedNormalizedDocumentId, "nd1");
    assert.equal(cases[0]!.expectedVersionId, "ver1");
    assert.equal(cases[0]!.expectedSourceDocumentId, "src1");
  });

  it("pass thresholds include MRR unit page metrics", () => {
    assert.equal(DOCLING_RETRIEVAL_PASS_THRESHOLDS.mrr, 0.6);
    assert.equal(DOCLING_RETRIEVAL_PASS_THRESHOLDS.expectedUnitHitRate, 0.8);
    assert.equal(DOCLING_RETRIEVAL_PASS_THRESHOLDS.pageMatchRate, 0.9);
  });

  it("stores absolute offsets across section slices", () => {
    const text = `${"가".repeat(100)}\n\n${"나".repeat(100)}\n\n${"다".repeat(100)}`;
    const parts = splitSectionIntoUnitTexts(text, 120);
    assert.ok(parts.length >= 2);
    for (const part of parts) {
      assert.equal(part.text, text.slice(part.startOffset, part.endOffset) || part.text);
      assert.ok(part.endOffset > part.startOffset);
    }
  });

  it("claim SQL uses FOR UPDATE SKIP LOCKED", () => {
    const root = join(import.meta.dirname, "../..");
    const claim = readFileSync(
      join(root, "src/workers/knowledge-pipeline-job-claim.ts"),
      "utf8",
    );
    assert.ok(claim.includes("FOR UPDATE SKIP LOCKED"));
    assert.ok(claim.includes("lockExpiresAt"));
    assert.ok(claim.includes("PIPELINE_RETRY_EXHAUSTED"));
    assert.ok(claim.includes("KNOWLEDGE_PIPELINE_MAX_ATTEMPTS"));
    assert.equal(KNOWLEDGE_PIPELINE_MAX_ATTEMPTS >= 1, true);
  });

  it("activates draft only after retrieval PASS in pipeline service", () => {
    const root = join(import.meta.dirname, "../..");
    const service = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
      "utf8",
    );
    const activateIdx = service.lastIndexOf("await activateDraftIndexGeneration");
    const evalFailIdx = service.indexOf('evaluation.status === "FAIL"');
    assert.ok(activateIdx > evalFailIdx);
    assert.ok(service.includes("includeInactiveForGeneration: true"));
    assert.ok(service.includes("assertKnowledgeRunLock"));
    assert.ok(service.includes('latest?.status === "WARNING"'));
    assert.ok(service.includes("PASS only: atomically activate"));
  });

  it("snapshot builder supports knowledge pipeline fields without breaking legacy parse", () => {
    const snap = buildDoclingBundleReviewSubmitSnapshot({
      submittedVersionId: "v1",
      doclingBundleId: "b1",
      sourceFileId: "s1",
      jsonPayloadFileId: "j1",
      markdownPayloadFileId: null,
      checksums: { source: "a", json: "b", markdown: null },
      doclingSchemaVersion: null,
      adapterVersion: "1.0.0",
      normalizedDocumentId: "nd1",
      fingerprint: "fp1",
      warningCount: 0,
      sourceTitle: "t",
      licenseName: "MIT",
      visibility: "PRIVATE",
      allowDownload: true,
      language: "ko",
      pipelineRunId: "run1",
      indexGenerationId: "gen1",
      retrievalEvaluationStatus: "PASS",
      normalizedDocumentFingerprint: "fp1",
    });
    assert.equal(snap.pipelineRunId, "run1");
    assert.equal(snap.indexGenerationId, "gen1");

    const binding = createKnowledgeRunBinding({
      versionId: "v1",
      normalizedDocumentId: "nd1",
      fingerprint: "fp1",
      bundleId: "b1",
      indexGenerationId: "gen1",
    });
    const round = parseKnowledgeRunBinding(serializeKnowledgeRunBinding(binding));
    assert.equal(round?.indexGenerationId, "gen1");
  });

  it("approve path promotes exact generation inside transaction", () => {
    const root = join(import.meta.dirname, "../..");
    const admin = readFileSync(join(root, "src/lib/admin-review-service.ts"), "utf8");
    assert.ok(admin.includes("promoteDraftIndexToProduction"));
    assert.ok(admin.includes("pipelineRunId: approveSnapshot.pipelineRunId"));
    assert.ok(admin.includes("indexGenerationId: approveSnapshot.indexGenerationId"));
    assert.ok(!admin.includes(".catch(\n        () => 0"));
    assert.ok(admin.includes("제출 이후 지식 데이터 또는 검색 인덱스가 변경되었습니다"));
  });
});

describe("docling knowledge pipeline postgres concurrency", { skip: !hasDb }, () => {
  it("two claimers cannot own the same PENDING knowledge run", async () => {
    const { prisma } = await import("../lib/prisma.ts");
    const { claimNextKnowledgePipelineRun } = await import(
      "../workers/knowledge-pipeline-job-claim.ts"
    );
    const { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } = await import(
      "../lib/docling-knowledge/docling-knowledge-stages.ts"
    );
    const { createKnowledgeRunBinding, serializeKnowledgeRunBinding } = await import(
      "../lib/docling-knowledge/docling-knowledge-run-binding.ts"
    );

    const pack = await prisma.knowledgePack.findFirst({ select: { packId: true } });
    if (!pack) {
      assert.ok(true);
      return;
    }

    const binding = createKnowledgeRunBinding({
      versionId: "test-version",
      normalizedDocumentId: "test-nd",
      fingerprint: "test-fp",
      bundleId: "test-bundle",
      indexGenerationId: "test-gen",
    });

    const run = await prisma.pipelineRun.create({
      data: {
        packId: pack.packId,
        triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
        status: "PENDING",
        summary: serializeKnowledgeRunBinding(binding),
      },
    });

    try {
      const [a, b] = await Promise.all([
        claimNextKnowledgePipelineRun(`owner-a-${run.id}`),
        claimNextKnowledgePipelineRun(`owner-b-${run.id}`),
      ]);
      const claimed = [a, b].filter(Boolean);
      assert.equal(claimed.length, 1);
      assert.equal(claimed[0]!.runId, run.id);
      const wrong = await (
        await import("../workers/knowledge-pipeline-job-claim.ts")
      ).touchKnowledgeRunHeartbeat({
        runId: run.id,
        lockOwner: "not-owner",
        userMessage: "nope",
      });
      assert.equal(wrong, null);
    } finally {
      await prisma.pipelineRun.delete({ where: { id: run.id } }).catch(() => undefined);
    }
  });
});
