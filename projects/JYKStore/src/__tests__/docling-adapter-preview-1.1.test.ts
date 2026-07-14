import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDataUriImage } from "../lib/adapters/docling/docling-figure-preview.ts";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import {
  classifyTable,
  normalizeDoclingTableData,
} from "../lib/adapters/docling/docling-table-normalize.ts";
import {
  isAbnormalTitleCandidate,
  selectNormalizedDocumentTitle,
  titleFromOriginFilename,
} from "../lib/adapters/docling/docling-title.ts";
import type { DoclingDocument } from "../lib/adapters/docling/docling-types.ts";
import { DOCLING_ADAPTER_VERSION } from "../lib/adapters/docling/docling-types.ts";
import { sanitizeMarkdownForPreview } from "../lib/adapters/docling/docling-markdown-validator.ts";
import { evaluateNormalizedDocumentQuality } from "../lib/docling-import/docling-quality-gate.ts";
import {
  collectContentTableSamples,
  collectFigureSamples,
} from "../lib/docling-import/structure-summary.ts";

/** Tiny valid 1×1 PNG. */
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_DATA_URI = `data:image/png;base64,${PNG_B64}`;

function historyTableCells() {
  const cells: Array<Record<string, unknown>> = [];
  const headers = ["개정일자", "내용", "비고"];
  for (let c = 0; c < 3; c += 1) {
    cells.push({
      text: headers[c],
      start_row_offset_idx: 0,
      end_row_offset_idx: 1,
      start_col_offset_idx: c,
      end_col_offset_idx: c + 1,
      column_header: true,
    });
  }
  for (let r = 1; r < 19; r += 1) {
    cells.push({
      text: `2025-0${(r % 9) + 1}-01`,
      start_row_offset_idx: r,
      end_row_offset_idx: r + 1,
      start_col_offset_idx: 0,
      end_col_offset_idx: 1,
    });
    cells.push({
      text: r === 1 ? "전면 개정" : `항목 ${r}`,
      start_row_offset_idx: r,
      end_row_offset_idx: r + 1,
      start_col_offset_idx: 1,
      end_col_offset_idx: 2,
    });
    // Empty remark cell
    cells.push({
      text: "",
      start_row_offset_idx: r,
      end_row_offset_idx: r + 1,
      start_col_offset_idx: 2,
      end_col_offset_idx: 3,
    });
  }
  // Merged cell example
  cells.push({
    text: "병합",
    start_row_offset_idx: 18,
    end_row_offset_idx: 19,
    start_col_offset_idx: 1,
    end_col_offset_idx: 3,
  });
  return {
    num_rows: 19,
    num_cols: 3,
    table_cells: cells,
  };
}

describe("docling adapter preview 1.1", () => {
  it("locks adapter version to 1.1.1", () => {
    assert.equal(DOCLING_ADAPTER_VERSION, "1.1.1");
  });

  it("rejects OCR junk title S CH7M 71015", () => {
    assert.equal(isAbnormalTitleCandidate("S CH7M 71015"), true);
    const selected = selectNormalizedDocumentTitle({
      headingCandidates: ["S CH7M 71015"],
      originFilename: "2025년_개정판_SW사업_대가산정_가이드03.pdf",
      jsonName: "S CH7M 71015",
      markdownText: "# 잘못된\n",
    });
    assert.ok(selected.title);
    assert.ok(!selected.title!.includes("CH7M"));
    assert.equal(selected.source, "filename");
    assert.ok(titleFromOriginFilename("2025년_개정판_SW사업_대가산정_가이드03.pdf"));
  });

  it("maps Docling table_cells to 19×3 with preview rows", () => {
    const data = normalizeDoclingTableData(historyTableCells(), {
      pageNumber: 3,
      caption: "제·개정이력",
      nearbyHeading: "제·개정이력",
      tableIndex: 5,
      totalTables: 20,
    });
    assert.equal(data.rowCount, 19);
    assert.equal(data.columnCount, 3);
    assert.ok(data.cellTextCount > 0);
    assert.equal(data.hasOnlyCoords, false);
    assert.equal(data.sourceHadTableCells, true);
    assert.ok(data.previewRows.length >= 3);
    assert.deepEqual(data.previewRows[0]?.slice(0, 3), ["개정일자", "내용", "비고"]);
    assert.equal(data.classification, "CONTENT_TABLE");
    assert.ok((data.classificationConfidence ?? 0) > 0.3);
    assert.ok((data.classificationReasons ?? []).length > 0);
  });

  it("classifies TOC vs content tables", () => {
    const toc = normalizeDoclingTableData(
      {
        num_rows: 8,
        num_cols: 2,
        table_cells: Array.from({ length: 8 }, (_, i) => [
          {
            text: `서론 ${".".repeat(12)}`,
            start_row_offset_idx: i,
            end_row_offset_idx: i + 1,
            start_col_offset_idx: 0,
            end_col_offset_idx: 1,
          },
          {
            text: String(i + 1),
            start_row_offset_idx: i,
            end_row_offset_idx: i + 1,
            start_col_offset_idx: 1,
            end_col_offset_idx: 2,
          },
        ]).flat(),
      },
      {
        pageNumber: 2,
        caption: null,
        nearbyHeading: "목차",
        tableIndex: 0,
        totalTables: 10,
      },
    );
    assert.notEqual(toc.classification, "CONTENT_TABLE");

    const figureIndex = classifyTable({
      cells: [{ row: 0, column: 0, rowSpan: 1, columnSpan: 1, text: "그림 1 … 10" }],
      rowCount: 1,
      columnCount: 1,
      caption: "그림 목차",
      nearbyHeading: "그림 목차",
      pageNumber: 4,
      tableIndex: 1,
      totalTables: 10,
    });
    assert.equal(figureIndex.classification, "FIGURE_INDEX");
  });

  it("builds body blocks and reading order from text/list_item", () => {
    const doc: DoclingDocument = {
      schema_name: "DoclingDocument",
      version: "1.10.0",
      name: "Guide",
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
          children: [{ $ref: "#/texts/0" }, { $ref: "#/texts/1" }, { $ref: "#/texts/2" }],
        },
      ],
      texts: [
        { self_ref: "#/texts/0", text: "서론", label: "section_header", prov: [{ page_no: 1 }] },
        {
          self_ref: "#/texts/1",
          text: "본 가이드는 SW사업 대가산정 기준을 설명한다.",
          label: "paragraph",
          prov: [{ page_no: 5 }],
        },
        {
          self_ref: "#/texts/2",
          text: "세부 항목",
          label: "list_item",
          prov: [{ page_no: 6 }],
        },
        { self_ref: "#/texts/3", text: "12", label: "page_footer" },
        { self_ref: "#/texts/4", text: "https://example.com", label: "text" },
      ],
      tables: [
        {
          self_ref: "#/tables/0",
          label: "table",
          caption: "제·개정이력",
          prov: [{ page_no: 3 }],
          data: historyTableCells(),
        },
      ],
      pictures: [
        {
          self_ref: "#/pictures/0",
          label: "picture",
          caption: "업무 흐름도",
          prov: [{ page_no: 8 }],
          image: { uri: PNG_DATA_URI },
        },
      ],
    };

    const draft = normalizeDoclingDocument(doc, {
      markdownText: "# 가이드\n\n본문",
      extractedPictureImages: [],
    });
    assert.ok(draft.title && !draft.title.includes("CH7M"));
    assert.ok(draft.sections.some((s) => s.text?.includes("대가산정")));
    assert.ok(draft.sections.some((s) => s.label === "list_item"));
    assert.ok(!draft.sections.some((s) => s.text === "12"));
    assert.ok(draft.readingOrder.length > 0);
    assert.ok(draft.readingOrder.every((r) => Boolean(r.ref)));

    const table = draft.tables[0]!.data as {
      rowCount: number;
      columnCount: number;
      classification: string;
    };
    assert.equal(table.rowCount, 19);
    assert.equal(table.columnCount, 3);
    assert.equal(table.classification, "CONTENT_TABLE");

    assert.equal(draft.figures[0]?.classification, "CONTENT_FIGURE");
    assert.ok(draft.figures[0]?._previewBytes);
    assert.ok(draft.figures[0]?._previewSha256);

    const contentTables = collectContentTableSamples(draft.tables, 5);
    assert.equal(contentTables.length, 1);
    const figureSamples = collectFigureSamples(draft.figures, 5);
    assert.equal(figureSamples.length, 1);
  });

  it("parses PNG data URI with magic bytes and hashes", () => {
    const parsed = parseDataUriImage(PNG_DATA_URI);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) return;
    assert.equal(parsed.mimeType, "image/png");
    assert.equal(parsed.sha256.length, 64);
    assert.ok(parsed.bytes.byteLength > 0);
  });

  it("strips markdown data URIs from preview", () => {
    const md = `![Image](${PNG_DATA_URI})\n\n본문 문장`;
    const cleaned = sanitizeMarkdownForPreview(md);
    assert.ok(!cleaned.includes("data:image"));
    assert.ok(!cleaned.toLowerCase().includes("base64,"));
    assert.ok(cleaned.includes("[이미지 데이터 생략]") || cleaned.includes("본문"));
  });

  it("blocks when all table_cells fail to map", () => {
    const draft = normalizeDoclingDocument({
      schema_name: "DoclingDocument",
      version: "1.10.0",
      name: "Bad Tables",
      origin: { filename: "sample.pdf", mimetype: "application/pdf" },
      body: { self_ref: "#/body", children: [{ $ref: "#/texts/0" }] },
      texts: [
        {
          self_ref: "#/texts/0",
          text: "문단 본문입니다.",
          label: "paragraph",
        },
      ],
      tables: [
        {
          self_ref: "#/tables/0",
          label: "table",
          data: {
            num_rows: 2,
            num_cols: 2,
            table_cells: [{ not_a_cell: true }, { also_bad: true }],
          },
        },
      ],
      pictures: [],
    });
    // mapTableCell still maps with empty text / default offsets — ensure gate sees sourceHadTableCells
    const tables = draft.tables.map((t) => ({
      ...t,
      data: {
        ...(t.data as object),
        sourceHadTableCells: true,
        cellTextCount: 0,
        hasOnlyCoords: true,
        rowCount: 2,
        rows: 2,
      },
    }));
    const gate = evaluateNormalizedDocumentQuality({
      title: draft.title,
      language: "ko",
      sections: draft.sections,
      tables,
      figures: draft.figures,
      readingOrder: draft.readingOrder,
      files: [
        { role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
        { role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
      ],
      markdownPreview: "ok",
      hasNormalizedDocument: true,
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.blockers.some((b) => b.code === "TABLE_CELLS_UNMAPPED"));
  });
});
