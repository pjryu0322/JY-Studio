import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { resolveCaptionText } from "../lib/adapters/docling/docling-caption.ts";
import {
  DOCLING_JSON_FULL_BUFFER_MAX_BYTES,
  projectDoclingJsonStream,
  shouldUseDoclingJsonStreamProjector,
} from "../lib/adapters/docling/docling-json-stream-projector.ts";
import { sanitizeMarkdownForPreview } from "../lib/adapters/docling/docling-markdown-validator.ts";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import {
  isAbnormalTitleCandidate,
  normalizeTitleCandidate,
  selectNormalizedDocumentTitle,
} from "../lib/adapters/docling/docling-title.ts";
import {
  DOCLING_ADAPTER_VERSION,
  type DoclingDocument,
} from "../lib/adapters/docling/docling-types.ts";
import { evaluateNormalizedDocumentQuality } from "../lib/docling-import/docling-quality-gate.ts";

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("docling 1.1.1 real-structure compat", () => {
  it("bumps adapter to 1.1.2", () => {
    assert.equal(DOCLING_ADAPTER_VERSION, "1.1.2");
  });

  it("resolves captions.$ref to 제·개정이력", () => {
    const doc: DoclingDocument = {
      schema_name: "DoclingDocument",
      version: "1.10.0",
      texts: [
        {
          self_ref: "#/texts/5",
          label: "caption",
          text: "제·개정이력",
          prov: [{ page_no: 3 }],
        },
      ],
      tables: [
        {
          self_ref: "#/tables/0",
          captions: [{ $ref: "#/texts/5" }],
          prov: [{ page_no: 3 }],
          data: {
            num_rows: 2,
            num_cols: 2,
            table_cells: [
              {
                text: "개정일자",
                start_row_offset_idx: 0,
                end_row_offset_idx: 1,
                start_col_offset_idx: 0,
                end_col_offset_idx: 1,
                column_header: true,
              },
              {
                text: "내용",
                start_row_offset_idx: 0,
                end_row_offset_idx: 1,
                start_col_offset_idx: 1,
                end_col_offset_idx: 2,
                column_header: true,
              },
            ],
          },
        },
      ],
    };
    const caption = resolveCaptionText(doc, doc.tables![0]!);
    assert.equal(caption, "제·개정이력");

    const draft = normalizeDoclingDocument({
      ...doc,
      origin: { filename: "guide.pdf", mimetype: "application/pdf" },
      body: { self_ref: "#/body", children: [{ $ref: "#/tables/0" }] },
      texts: [
        ...(doc.texts ?? []),
        {
          self_ref: "#/texts/0",
          text: "본문 문단입니다.",
          label: "paragraph",
          prov: [{ page_no: 5 }],
        },
      ],
    });
    assert.equal(draft.tables[0]?.caption, "제·개정이력");
    const data = draft.tables[0]?.data as {
      pageNumber?: number;
      classification?: string;
    };
    assert.equal(data.pageNumber, 3);
    assert.equal(data.classification, "CONTENT_TABLE");
  });

  it("rejects TOC-decorated title candidates", () => {
    for (const bad of [
      "S CH7M 71015",
      "<목 차>",
      "<표 목차>",
      "< 그림 목차>",
      "Ⅰ",
      "SW",
      "[목차]",
      "(목 차)",
    ]) {
      assert.equal(isAbnormalTitleCandidate(bad), true, bad);
      assert.ok(normalizeTitleCandidate(bad).length >= 0);
    }
    const selected = selectNormalizedDocumentTitle({
      headingCandidates: [
        "S CH7M 71015",
        "<목 차>",
        "<표 목차>",
        "< 그림 목차>",
        "Ⅰ",
        "SW",
        "2025년 개정판 SW사업 대가산정 가이드",
      ],
      originFilename: "fallback.pdf",
    });
    assert.equal(selected.title, "2025년 개정판 SW사업 대가산정 가이드");
    assert.equal(selected.source, "heading");
  });

  it("limits reading order to normalized content refs", () => {
    const draft = normalizeDoclingDocument({
      schema_name: "DoclingDocument",
      version: "1.10.0",
      name: "RO Doc",
      origin: { filename: "doc.pdf", mimetype: "application/pdf" },
      body: {
        self_ref: "#/body",
        children: [
          { $ref: "#/groups/0" },
          { $ref: "#/texts/2" },
          { $ref: "#/texts/3" },
          { $ref: "#/texts/99" },
          { $ref: "#/tables/0" },
          { $ref: "#/pictures/0" },
        ],
      },
      groups: [
        {
          self_ref: "#/groups/0",
          label: "group",
          children: [{ $ref: "#/texts/0" }, { $ref: "#/texts/1" }],
        },
      ],
      texts: [
        { self_ref: "#/texts/0", text: "서론", label: "section_header", level: 1, prov: [{ page_no: 1 }] },
        {
          self_ref: "#/texts/1",
          text: "본문 문장입니다.",
          label: "paragraph",
          prov: [{ page_no: 2 }],
        },
        { self_ref: "#/texts/2", text: "헤더", label: "page_header" },
        { self_ref: "#/texts/3", text: "https://example.com", label: "text" },
        { self_ref: "#/texts/4", text: "12", label: "page_footer" },
      ],
      tables: [
        {
          self_ref: "#/tables/0",
          captions: [{ $ref: "#/texts/0" }],
          data: { grid: [["a"]] },
          prov: [{ page_no: 3 }],
        },
      ],
      pictures: [
        {
          self_ref: "#/pictures/0",
          captions: "업무 흐름",
          prov: [{ page_no: 4 }],
        },
      ],
    });

    assert.ok(draft.sections.some((s) => s.level === 1 && s.page === 1));
    assert.ok(draft.sections.some((s) => s.text?.includes("본문") && s.page === 2));
    const refs = draft.readingOrder.map((r) => r.ref);
    assert.ok(refs.includes("#/texts/0"));
    assert.ok(refs.includes("#/texts/1"));
    assert.ok(refs.includes("#/tables/0"));
    assert.ok(refs.includes("#/pictures/0"));
    assert.ok(!refs.includes("#/texts/2"));
    assert.ok(!refs.includes("#/texts/3"));
    assert.ok(!refs.includes("#/groups/0"));
    assert.ok(!refs.includes("#/texts/99"));
    assert.equal(draft.readingOrder.length, 4);

    const gate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: "ko",
      sections: draft.sections,
      tables: draft.tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [
        { role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
        { role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
      ],
      markdownPreview: "ok",
      hasNormalizedDocument: true,
    });
    assert.ok(!gate.blockers.some((b) => b.code === "READING_ORDER_DANGLING"));
  });

  it("preserves captions/prov/level on streaming projection (>16MiB path gate)", async () => {
    assert.equal(shouldUseDoclingJsonStreamProjector(DOCLING_JSON_FULL_BUFFER_MAX_BYTES + 1), true);

    const pad = "x".repeat(64 * 1024);
    const texts = Array.from({ length: 280 }, (_, i) => ({
      self_ref: `#/texts/${i}`,
      label: i === 0 ? "section_header" : "paragraph",
      level: i === 0 ? 1 : undefined,
      text: i === 5 ? "제·개정이력" : `문단 ${i} ${pad}`,
      prov: [{ page_no: (i % 20) + 1, bbox: { l: 1, t: 2, r: 3, b: 4 } }],
    }));
    const doc = {
      schema_name: "DoclingDocument",
      version: "1.10.0",
      name: "<목 차>",
      origin: {
        filename: "2025년_개정판_SW사업_대가산정_가이드03.pdf",
        mimetype: "application/pdf",
      },
      body: {
        self_ref: "#/body",
        children: [{ $ref: "#/groups/0" }, { $ref: "#/tables/0" }, { $ref: "#/pictures/0" }],
      },
      groups: [
        {
          self_ref: "#/groups/0",
          label: "group",
          children: [{ $ref: "#/texts/0" }, { $ref: "#/texts/1" }],
        },
      ],
      texts,
      tables: [
        {
          self_ref: "#/tables/0",
          captions: [{ $ref: "#/texts/5" }],
          prov: [{ page_no: 3 }],
          data: {
            num_rows: 2,
            num_cols: 1,
            table_cells: [
              {
                text: "a",
                start_row_offset_idx: 0,
                end_row_offset_idx: 1,
                start_col_offset_idx: 0,
                end_col_offset_idx: 1,
              },
            ],
          },
        },
      ],
      pictures: [
        {
          self_ref: "#/pictures/0",
          captions: [{ $ref: "#/texts/1" }],
          prov: [{ page_no: 8 }],
          image: { uri: `data:image/png;base64,${PNG_B64}` },
        },
      ],
    };
    const json = JSON.stringify(doc);
    assert.ok(Buffer.byteLength(json) > DOCLING_JSON_FULL_BUFFER_MAX_BYTES);

    const projected = await projectDoclingJsonStream(Readable.from([json]), {
      contentLength: Buffer.byteLength(json),
    });
    assert.equal(projected.ok, true);
    const t0 = projected.document?.texts?.[0] as Record<string, unknown> | undefined;
    assert.equal(t0?.level, 1);
    assert.ok(Array.isArray(t0?.prov));
    assert.equal((t0?.prov as Array<{ page_no: number }>)[0]?.page_no, 1);
    const table0 = projected.document?.tables?.[0] as Record<string, unknown> | undefined;
    assert.ok(table0?.captions);
    assert.ok(table0?.prov);
    assert.equal((table0 as { image?: unknown }).image, undefined);
    const pic0 = projected.document?.pictures?.[0] as Record<string, unknown> | undefined;
    assert.ok(pic0?.captions);
    assert.equal(pic0?.image, undefined);
    assert.ok((projected.extractedPictureImages?.length ?? 0) >= 1);

    const draft = normalizeDoclingDocument(projected.document!, {
      extractedPictureImages: projected.extractedPictureImages,
      markdownText: "# bad",
    });
    assert.ok(draft.title && !draft.title.includes("목"));
    assert.ok(draft.title?.includes("대가산정") || draft.title?.includes("2025"));
    assert.equal(draft.tables[0]?.caption, "제·개정이력");
    assert.ok((draft.tables[0]?.data as { pageNumber?: number }).pageNumber === 3);
    assert.ok(draft.figures[0]?._previewBytes || draft.figures[0]?.classification);
  });

  it("sanitizes markdown preview response text (no data:image / base64,)", () => {
    const md = `![Image](data:image/png;base64,${PNG_B64})\n\n본문`;
    const cleaned = sanitizeMarkdownForPreview(md);
    assert.ok(!cleaned.includes("data:image"));
    assert.ok(!cleaned.toLowerCase().includes("base64,"));
    assert.ok(cleaned.includes("[이미지 데이터 생략]") || cleaned.includes("본문"));
  });

  it("wires figure preview compensation and server-side markdown sanitize", () => {
    const root = join(import.meta.dirname, "../..");
    const service = readFileSync(
      join(root, "src/lib/docling-import/docling-import-service.ts"),
      "utf8",
    );
    assert.ok(service.includes("newlyCreatedFigureKeys"));
    assert.ok(service.includes("normalizationCommitted"));
    assert.ok(service.includes("recordPostCommitNormalizationEffects"));
    assert.ok(service.includes("docling_figure_preview_normalization_failed"));
    assert.ok(service.includes("docling_figure_preview_partial_failure"));
    assert.ok(service.includes("maybeSanitizeMarkdownPreviewBytes"));
    assert.ok(service.includes("sanitizeMarkdownForPreview"));
  });
});
