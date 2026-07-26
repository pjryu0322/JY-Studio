import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWorkerSourceDocumentContent,
  resolveWorkerSourceDocumentFormat,
  resolveWorkerSourceDocumentType,
} from "../lib/python-worker/worker-source-document-content.ts";
import { buildWorkerZipRunsMarkdown } from "../lib/worker-zip-runs-markdown.ts";
import { buildQualityCheckHistoryMarkdown } from "../lib/quality-check-history-markdown.ts";
import type { AdminWorkerZipRunView } from "../lib/admin-review-api.ts";
import type { AdminWorkerZipQualityRefreshResult } from "../lib/admin-review-api.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function sampleRun(overrides?: Partial<AdminWorkerZipRunView>): AdminWorkerZipRunView {
  return {
    runId: "run-1",
    status: "PASS",
    currentStep: "INDEXING",
    currentStepLabel: "검색 인덱스",
    startedAt: "2026-07-21T14:37:00.000Z",
    finishedAt: "2026-07-21T14:48:40.000Z",
    durationMs: 700_000,
    message: null,
    errorMessage: null,
    summary: { importedChunkCount: 10, importedEmbeddingCount: 10, excludedFiles: 0 },
    stepLogs: [
      {
        step: "ACCEPTED",
        status: "PASS",
        message: "ACCEPTED",
        createdAt: "2026-07-21T14:37:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("worker source document content (quality-gate wiring)", () => {
  it("flattens ND sections into SourceDocument content", () => {
    const content = buildWorkerSourceDocumentContent({
      sourcePath: "Docs/install.html",
      title: "Install",
      sections: [
        { heading: "설치", content: "패키지를 설치합니다." },
        { heading: "설정", content: "옵션을 구성합니다." },
      ],
    });
    assert.match(content, /설치/);
    assert.match(content, /옵션을 구성/);
  });

  it("maps path cues to Prisma SourceType / SourceFormat", () => {
    assert.equal(
      resolveWorkerSourceDocumentType({ sourcePath: "samples/grid-example.html", title: "Sample" }),
      "SAMPLE_CODE",
    );
    assert.equal(
      resolveWorkerSourceDocumentType({ sourcePath: "Docs/api/overview.html", title: "API" }),
      "API_SPEC",
    );
    assert.equal(resolveWorkerSourceDocumentFormat({ sourcePath: "Docs/a.html" }), "HTML");
  });

  it("exposes a Worker ZIP quality-refresh Admin route (not the frozen legacy review-refresh)", () => {
    const route = readFileSync(
      path.join(root, "src/app/api/v1/admin/packs/[packId]/worker-zip/quality-refresh/route.ts"),
      "utf8",
    );
    assert.match(route, /refreshWorkerZipReviewReadiness/);
    assert.match(route, /requireAdminSession/);

    const card = readFileSync(
      path.join(root, "src/components/AdminWorkerZipGenerationCard.tsx"),
      "utf8",
    );
    assert.match(card, /runAdminWorkerZipQualityRefresh/);
    assert.match(card, /품질 점검/);
    assert.match(card, /QualityPipelineProgress/);
    assert.match(card, /QualityCheckHistoryCard/);
    assert.match(card, /buildQualitySnapshotFromDetail/);
    assert.match(card, /buildQualityCheckHistoryMarkdown/);
    assert.match(card, /새로고침/);
    assert.match(card, /점검내역 MD 다운로드/);
    assert.doesNotMatch(card, /세부 판단 근거 보기/);
    assert.doesNotMatch(card, /JudgmentEvidenceModal/);
  });
});

describe("quality check history markdown export", () => {
  it("includes pipeline, readiness, and issue sections", () => {
    const qualityResult: AdminWorkerZipQualityRefreshResult = {
      ok: true,
      clientId: "c1",
      packId: "pack-1",
      backfilledSourceDocuments: 2,
      retypedSourceDocuments: 1,
      stepsCompleted: ["source_validation", "structure_quality", "chunk_quality"],
      warnings: ["sample warning"],
      stoppedAt: null,
      readiness: {
        sourceValidation: { passCount: 10, warningCount: 2, failCount: 0, notCheckedCount: 0 },
        structureCoverageStatus: "PASS",
        knowledgeQualityStatus: "WARNING",
        structureQualityMessage: "구조 메시지",
        chunkQualityStatus: "PASS",
        chunkQualityMessage: null,
        retrievalEvaluationStatus: null,
        retrievalEvaluationMessage: null,
        releaseGateStatus: null,
        releaseGateMessage: null,
      },
    };
    const md = buildQualityCheckHistoryMarkdown({
      packId: "pack-1",
      qualityResult,
      exportedAt: "2026-07-22T00:00:00.000Z",
    });
    assert.match(md, /# 품질점검 내역/);
    assert.match(md, /packId: `pack-1`/);
    assert.match(md, /원천 검증/);
    assert.match(md, /구조\/품질/);
    assert.match(md, /sample warning/);
    assert.match(md, /원천 본문 보완: 2건/);
    assert.match(md, /## Readiness 요약/);
    assert.match(md, /구조 커버리지: PASS/);
  });
});

describe("AdminWorkerZipRunsPanel markdown export", () => {
  it("includes current and past runs with step logs", () => {
    const md = buildWorkerZipRunsMarkdown({
      packId: "pack-1",
      currentRun: sampleRun(),
      pastRuns: [
        sampleRun({
          runId: "run-old",
          status: "FAIL",
          errorMessage: "boom",
          currentStepLabel: "구조 검증",
        }),
      ],
    });
    assert.match(md, /# Worker 작업 내역/);
    assert.match(md, /packId: `pack-1`/);
    assert.match(md, /## 현재 작업/);
    assert.match(md, /## 과거 작업 내역 \(1건\)/);
    assert.match(md, /run-1/);
    assert.match(md, /run-old/);
    assert.match(md, /단계 로그/);
    assert.match(md, /boom/);
  });

  it("shows only the current run in the panel; MD export still covers past runs", () => {
    const src = readFileSync(
      path.join(root, "src/components/AdminWorkerZipRunsPanel.tsx"),
      "utf8",
    );
    assert.doesNotMatch(src, /과거 작업 내역 \$\{/);
    assert.doesNotMatch(src, /showPastRuns/);
    assert.doesNotMatch(src, /단계 로그 접기/);
    assert.doesNotMatch(src, /단계 로그 펼치기/);
    assert.match(src, /buildWorkerZipRunsMarkdown/);
    assert.match(src, /작업 내역 MD 다운로드/);
  });
});
