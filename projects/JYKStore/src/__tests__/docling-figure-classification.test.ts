import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  classifyFigure,
  classifyFigures,
} from "../lib/adapters/docling/docling-figure-preview.ts";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import type { DoclingDocument, NormalizedFigure } from "../lib/adapters/docling/docling-types.ts";
import { DOCLING_ADAPTER_VERSION } from "../lib/adapters/docling/docling-types.ts";
import { evaluateNormalizedDocumentQuality } from "../lib/docling-import/docling-quality-gate.ts";
import { collectFigureSamples } from "../lib/docling-import/structure-summary.ts";

describe("docling figure classification & sample fallback", () => {
  it("bumps adapter for reprocess after classification fix", () => {
    assert.equal(DOCLING_ADAPTER_VERSION, "1.1.2");
  });

  it("does not mark unknown size as DECORATIVE via extreme_aspect", () => {
    const result = classifyFigure({
      width: null,
      height: null,
      caption: null,
      pageNumber: 19,
      duplicateCount: 1,
      sha256: null,
      pictureIndex: 0,
    });
    assert.notEqual(result.classification, "DECORATIVE");
    assert.equal(result.classification, "UNKNOWN");
    assert.ok(!result.reasons.includes("extreme_aspect"));
    assert.ok(result.reasons.includes("insufficient_metadata"));
  });

  it("marks extreme aspect as DECORATIVE only with valid size", () => {
    const result = classifyFigure({
      width: 1000,
      height: 100,
      caption: null,
      pageNumber: 10,
      duplicateCount: 1,
      sha256: "a".repeat(64),
      pictureIndex: 0,
    });
    assert.equal(result.classification, "DECORATIVE");
    assert.ok(result.reasons.includes("extreme_aspect"));
  });

  it("classifies mid-doc medium size as CONTENT_FIGURE", () => {
    const result = classifyFigure({
      width: 800,
      height: 600,
      pageNumber: 19,
      caption: null,
      duplicateCount: 1,
      sha256: "b".repeat(64),
      pictureIndex: 0,
    });
    assert.equal(result.classification, "CONTENT_FIGURE");
    assert.ok(result.reasons.includes("mid_doc_medium_size"));
  });

  it("classifies large uncaptioned page-1 image as COVER_IMAGE", () => {
    const result = classifyFigure({
      pageNumber: 1,
      width: 1200,
      height: 1600,
      caption: null,
      duplicateCount: 1,
      sha256: "c".repeat(64),
      pictureIndex: 0,
    });
    assert.equal(result.classification, "COVER_IMAGE");
  });

  it("classifies repeated SHA as LOGO", () => {
    const result = classifyFigure({
      pageNumber: 5,
      width: 200,
      height: 80,
      caption: null,
      duplicateCount: 3,
      sha256: "d".repeat(64),
      pictureIndex: 0,
    });
    assert.equal(result.classification, "LOGO");
    assert.ok(result.reasons.includes("repeated_hash"));
  });

  it("reclassifies after streaming extractedPictureImages metadata attach", () => {
    const bytes = Uint8Array.from({ length: 64 }, (_, i) => i);
    const sha = createHash("sha256").update(bytes).digest("hex");
    const doc: DoclingDocument = {
      schema_name: "DoclingDocument",
      version: "1.10.0",
      name: "Guide",
      origin: { filename: "guide.pdf", mimetype: "application/pdf" },
      body: {
        self_ref: "#/body",
        children: [{ $ref: "#/texts/0" }, { $ref: "#/pictures/0" }],
      },
      texts: [
        {
          self_ref: "#/texts/0",
          text: "본문 문단입니다.",
          label: "paragraph",
          prov: [{ page_no: 19 }],
        },
      ],
      tables: [],
      pictures: [
        {
          self_ref: "#/pictures/0",
          label: "picture",
          // No inline image.uri — size unknown until streaming attach.
          prov: [{ page_no: 19 }],
        },
      ],
    };

    const withoutMeta = normalizeDoclingDocument(doc, { extractedPictureImages: [] });
    assert.equal(withoutMeta.figures[0]?.classification, "UNKNOWN");
    assert.ok(
      (withoutMeta.figures[0]?.classificationReasons ?? []).includes("insufficient_metadata"),
    );

    const withMeta = normalizeDoclingDocument(doc, {
      extractedPictureImages: [
        {
          selfRef: "#/pictures/0",
          mimeType: "image/png",
          bytes,
          sha256: sha,
          width: 800,
          height: 600,
        },
      ],
    });
    assert.equal(withMeta.figures[0]?.classification, "CONTENT_FIGURE");
    assert.ok(
      (withMeta.figures[0]?.classificationReasons ?? []).includes("mid_doc_medium_size"),
    );
    assert.notEqual(withMeta.figures[0]?.classification, "DECORATIVE");
  });

  it("classifyFigures recomputes duplicate counts across attached SHAs", () => {
    const sha = "e".repeat(64);
    const classified = classifyFigures([
      {
        id: "a",
        caption: null,
        pageNumber: 3,
        width: 400,
        height: 300,
        _previewSha256: sha,
      },
      {
        id: "b",
        caption: null,
        pageNumber: 7,
        width: 400,
        height: 300,
        _previewSha256: sha,
      },
      {
        id: "c",
        caption: null,
        pageNumber: 9,
        width: 400,
        height: 300,
        _previewSha256: sha,
      },
    ]);
    assert.ok(classified.every((f) => f.classification === "LOGO"));
  });

  it("shows fallback figure samples without mutating classification", () => {
    const figures: NormalizedFigure[] = [2, 10, 15, 20, 25].map((page, i) => ({
      id: `#/pictures/${i}`,
      caption: null,
      label: null,
      sourceRef: `#/pictures/${i}`,
      page,
      pageNumber: page,
      width: 500,
      height: 400,
      classification: "DECORATIVE",
      classificationReasons: ["extreme_aspect"],
      previewObjectKey: `key-${i}`,
    }));

    const samples = collectFigureSamples(figures, 5);
    assert.ok(samples.length > 0);
    assert.ok(samples.length <= 3);
    assert.ok(samples.every((s) => s.isFallbackCandidate));
    assert.ok(samples.every((s) => (s.page ?? 0) >= 2));
    assert.ok(figures.every((f) => f.classification === "DECORATIVE"));
  });

  it("warns when all figures are decorative without blocking", () => {
    const figures: NormalizedFigure[] = [
      {
        id: "#/pictures/0",
        caption: null,
        label: null,
        sourceRef: "#/pictures/0",
        page: 1,
        pageNumber: 1,
        classification: "COVER_IMAGE",
        previewObjectKey: "k0",
      },
      {
        id: "#/pictures/1",
        caption: null,
        label: null,
        sourceRef: "#/pictures/1",
        page: 5,
        pageNumber: 5,
        classification: "DECORATIVE",
        previewObjectKey: "k1",
      },
    ];
    const gate = evaluateNormalizedDocumentQuality({
      title: "Doc",
      language: "ko",
      sections: [
        {
          id: "#/texts/0",
          title: null,
          text: "본문입니다.",
          label: "paragraph",
          level: null,
          sourceRef: "#/texts/0",
          children: [],
        },
      ],
      tables: [],
      figures,
      readingOrder: [{ index: 0, ref: "#/texts/0", kind: "texts" }],
      files: [
        { role: "SOURCE_ORIGINAL", checksumSha256: "a".repeat(64) },
        { role: "DOCLING_JSON", checksumSha256: "b".repeat(64) },
      ],
      markdownPreview: "ok",
      hasNormalizedDocument: true,
    });
    assert.ok(
      gate.warnings.some((w) => w.code === "FIGURE_CLASSIFICATION_ALL_DECORATIVE"),
    );
    assert.equal(gate.blockers.filter((b) => b.code === "FIGURE_CLASSIFICATION_ALL_DECORATIVE").length, 0);
  });
});
