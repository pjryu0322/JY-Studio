import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import type { DoclingDocument } from "../lib/adapters/docling/docling-types.ts";
import {
  evaluateNormalizedDocumentQuality,
  evaluateNormalizedDocumentStructureQuality,
} from "../lib/docling-import/docling-quality-gate.ts";
import { resolveDoclingKnowledgeStageNextAction } from "../lib/docling-knowledge/docling-knowledge-pipeline-service.ts";

const GOOD_QUALITY_DOCLING: DoclingDocument = {
  schema_name: "DoclingDocument",
  version: "1.10.0",
  name: "Good Doc",
  origin: { filename: "good.pdf", mimetype: "application/pdf" },
  body: {
    self_ref: "#/body",
    children: [
      { $ref: "#/texts/0" },
      { $ref: "#/texts/1" },
      { $ref: "#/tables/0" },
      { $ref: "#/pictures/0" },
    ],
  },
  texts: [
    {
      self_ref: "#/texts/0",
      text: "정보시스템 감리 개요",
      label: "section_header",
      prov: [{ page_no: 1 }],
    },
    {
      self_ref: "#/texts/1",
      text: "본문은 감리 절차를 설명합니다.",
      label: "paragraph",
      prov: [{ page_no: 2 }],
    },
  ],
  tables: [
    {
      self_ref: "#/tables/0",
      label: "table",
      caption: "점검 항목 표",
      data: { grid: [["항목", "기준"], ["가용성", "충족"]] },
      prov: [{ page_no: 3 }],
    },
  ],
  pictures: [
    {
      self_ref: "#/pictures/0",
      label: "picture",
      caption: "구조도",
      prov: [{ page_no: 4 }],
    },
  ],
};

describe("docling structure-only quality gate", () => {
  it("STRUCTURE_ONLY with empty files does not emit REQUIRED_FILES_MISSING", () => {
    const draft = normalizeDoclingDocument(GOOD_QUALITY_DOCLING);
    const gate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: "ko",
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [],
      hasNormalizedDocument: true,
      markdownPreview: null,
      validationScope: "STRUCTURE_ONLY",
    });
    assert.equal(
      gate.blockers.some((b) => b.code === "REQUIRED_FILES_MISSING"),
      false,
    );
    assert.equal(gate.ok, true);
  });

  it("evaluateNormalizedDocumentStructureQuality skips file requirements", () => {
    const draft = normalizeDoclingDocument(GOOD_QUALITY_DOCLING);
    const gate = evaluateNormalizedDocumentStructureQuality({
      title: draft.title,
      language: "ko",
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      hasNormalizedDocument: true,
    });
    assert.equal(gate.ok, true);
    assert.equal(
      gate.blockers.some((b) => b.code === "REQUIRED_FILES_MISSING"),
      false,
    );
  });

  it("FULL_IMPORT still requires SOURCE_ORIGINAL and DOCLING_JSON", () => {
    const draft = normalizeDoclingDocument(GOOD_QUALITY_DOCLING);
    const gate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: "ko",
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [],
      hasNormalizedDocument: true,
      validationScope: "FULL_IMPORT",
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.blockers.some((b) => b.code === "REQUIRED_FILES_MISSING"));
  });

  it("default validationScope remains FULL_IMPORT", () => {
    const draft = normalizeDoclingDocument(GOOD_QUALITY_DOCLING);
    const gate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: "ko",
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [{ role: "DOCLING_JSON", checksumSha256: "b".repeat(64) }],
      hasNormalizedDocument: true,
    });
    assert.ok(gate.blockers.some((b) => b.code === "REQUIRED_FILES_MISSING"));
  });
});

describe("docling knowledge stage nextAction", () => {
  it("idle confirmed pack prompts start only on pending stages", () => {
    assert.equal(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "STRUCTURE",
        status: "PENDING",
        providerConfirmed: true,
        running: false,
        priorFailed: false,
      }),
      "지식 데이터 생성을 시작해 주세요.",
    );
  });

  it("pending after prior fail waits instead of start", () => {
    assert.equal(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "KNOWLEDGE_UNIT",
        status: "PENDING",
        providerConfirmed: true,
        running: false,
        priorFailed: true,
      }),
      "문서 구조 확인을 통과해야 지식 단위 생성이 진행됩니다.",
    );
    assert.equal(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "RETRIEVAL_CHUNK",
        status: "PENDING",
        providerConfirmed: true,
        running: false,
        priorFailed: true,
      }),
      "지식 단위 생성이 완료되어야 Retrieval Chunk 생성이 진행됩니다.",
    );
  });

  it("running pending waits for prior completion", () => {
    assert.equal(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "SEARCH_INDEX",
        status: "PENDING",
        providerConfirmed: true,
        running: true,
        priorFailed: false,
      }),
      "선행 단계가 완료되면 자동으로 진행됩니다.",
    );
  });

  it("structure binding failure guides refresh, not re-upload", () => {
    assert.equal(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "STRUCTURE",
        status: "FAIL",
        providerConfirmed: true,
        running: false,
        priorFailed: false,
        failureCode: "DOCLING_BUNDLE_MISMATCH",
      }),
      "자료 등록 상태를 새로고침한 뒤 다시 시도해 주세요.",
    );
    assert.equal(
      resolveDoclingKnowledgeStageNextAction({
        stageId: "STRUCTURE",
        status: "FAIL",
        providerConfirmed: true,
        running: false,
        priorFailed: false,
        failureCode: null,
      }),
      "표시된 구조 문제를 확인한 뒤 파일을 교체하거나 다시 처리해 주세요.",
    );
  });
});

describe("docling knowledge pipeline structure stage wiring", () => {
  it("uses STRUCTURE_ONLY and separate binding failure codes", () => {
    const root = join(import.meta.dirname, "../..");
    const service = [
      readFileSync(
        join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-status.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-status-policy.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-runner-structure.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-execute.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-runner-chunk.ts"),
        "utf8",
      ),
      readFileSync(
        join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-runner-knowledge.ts"),
        "utf8",
      ),
    ].join("\n");
    assert.ok(service.includes("evaluateNormalizedDocumentStructureQuality"));
    assert.ok(!service.includes("files: []"));
    assert.ok(service.includes("DOCLING_BUNDLE_MISMATCH"));
    assert.ok(service.includes("DOCLING_BUNDLE_NOT_READY"));
    assert.ok(service.includes("FINGERPRINT_MISMATCH"));
    assert.ok(service.includes("NORMALIZED_DOCUMENT_MISMATCH"));
    assert.ok(service.includes("IMPORT_ONLY_QUALITY_CODES"));
    assert.ok(service.includes("resolveDoclingKnowledgeStageNextAction"));
    assert.ok(service.includes("선행 단계 실패로 대기 중입니다.") || service.includes("문서 구조 확인을 통과해야"));
    assert.ok(service.includes('advisory: quality.warnings.length > 0'));
    assert.ok(service.includes("KNOWLEDGE_COVERAGE_WARNING") || service.includes("built.stepStatus"));
    assert.ok(service.includes("검색데이터 생성 대기") || service.includes("awaiting search data"));
  });

  it("knowledge tab keeps ops JSON collapsed by default and shows advisory badge copy", () => {
    const root = join(import.meta.dirname, "../..");
    const ui = readFileSync(
      join(root, "src/components/provider-distribution/ProviderKnowledgeGenerationTab.tsx"),
      "utf8",
    );
    assert.ok(ui.includes('expanded === stage.id ? "상세 접기" : "상세 보기"'));
    assert.ok(ui.includes("운영 상세(JSON)"));
    assert.ok(ui.includes("showRaw"));
    assert.ok(ui.includes("완료 · 확인사항"));
    assert.ok(ui.includes("eligibleBodyCoverage"));
  });
});
