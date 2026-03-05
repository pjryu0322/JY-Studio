import { describe, expect, it } from "vitest";
import { buildDocumentBlocks } from "./blockBuilder";
import { buildChunksFromBlocks } from "./chunkEngine";
import { extractTags, normalizeConstraintInfo } from "./rules/constraints";
import { removeHeaderFooterNoise } from "./rules/headerFooter";
import { detectHeading } from "./rules/headingPatterns";
import { estimateOcrQuality, ocrWarningsFromQuality } from "./rules/ocrQuality";
import { splitSentences } from "./rules/sentenceSplit";
import { buildChunkDiffSummary } from "./reporting/chunkDiff";
import { buildQualityReport } from "./reporting/qualityReport";
import { DEFAULT_CHUNK_CONFIG } from "./types";

describe("headingPatterns", () => {
  it("infers heading levels for korean RFP patterns", () => {
    expect(detectHeading("제 1 장 사업개요").level).toBe(1);
    expect(detectHeading("1.2 평가기준").level).toBe(2);
    expect(detectHeading("① 제안서 작성").level).toBe(5);
  });
});

describe("sentenceSplit", () => {
  it("splits korean sentences", () => {
    const out = splitSentences("본 사업은 필수 요건이다. 기한 내 제출해야 한다. 금지 항목이 있다.");
    expect(out.length).toBe(3);
  });
});

describe("constraints tagging", () => {
  it("extracts requirement and deadline tags", () => {
    const tags = extractTags("반드시 기한 내 제출해야 하며 위반 시 벌점이 부여된다.");
    expect(tags).toContain("CONSTRAINT_MUST");
    expect(tags).toContain("DEADLINE");
    expect(tags).toContain("PENALTY");
  });
});

describe("table parsing", () => {
  it("builds table struct with header", () => {
    const text = "표 1 평가배점\n항목|배점\n정량|40\n정성|60";
    const result = buildDocumentBlocks(text);
    const table = result.tables[0];
    expect(table).toBeDefined();
    expect(table.header?.[0]).toBe("항목");
    expect(table.rows.length).toBe(3);
  });
});

describe("header footer cleaning", () => {
  it("removes repeated noise lines", () => {
    const blocks = buildDocumentBlocks(
      "기관명 2026\n\n본문 A\n\n기관명 2026\n\n본문 B\n\n기관명 2026"
    ).blocks;
    const cleaned = removeHeaderFooterNoise(blocks, 0.5);
    expect(cleaned.log.removed.length).toBeGreaterThan(0);
  });

  it("uses positional method when bbox/page exists", () => {
    const blocks = [
      { id: "a", type: "paragraph", text: "기관명 2026", blockIndex: 0, page: 1, bbox: { x: 0.1, y: 0.05, w: 0.5, h: 0.03 } },
      { id: "b", type: "paragraph", text: "본문1", blockIndex: 1, page: 1, bbox: { x: 0.1, y: 0.4, w: 0.5, h: 0.03 } },
      { id: "c", type: "paragraph", text: "기관명 2026", blockIndex: 2, page: 2, bbox: { x: 0.1, y: 0.04, w: 0.5, h: 0.03 } },
      { id: "d", type: "paragraph", text: "본문2", blockIndex: 3, page: 2, bbox: { x: 0.1, y: 0.44, w: 0.5, h: 0.03 } },
    ] as const;
    const cleaned = removeHeaderFooterNoise(blocks as never[], 0.5);
    expect(cleaned.log.method).toBe("pos+freq");
    expect(cleaned.log.removed.length).toBeGreaterThan(0);
  });
});

describe("chunkEngine and quality report", () => {
  it("creates chunks with overlap and report", () => {
    const text = `
제 1 장 개요
본 사업은 반드시 수행하여야 한다. 제안사는 기한 내 산출물을 제출해야 한다.
1. 요구사항
가. 서버 구성
나. 보안 요구사항
표 1|항목|값
A|가용성|99.9
B|RTO|2시간
`;
    const blocks = buildDocumentBlocks(text).blocks;
    const chunks = buildChunksFromBlocks(blocks, {
      ...DEFAULT_CHUNK_CONFIG,
      maxTokens: 40,
      targetTokens: 30,
      minTokens: 10,
      overlapSentences: 1,
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.meta.tags.length > 0)).toBe(true);
    const report = buildQualityReport(chunks);
    expect(report.totalChunks).toBe(chunks.length);
  });

  it("creates deterministic chunkId for same input", () => {
    const blocks = buildDocumentBlocks("제 1 장 개요\n반드시 제출해야 한다.").blocks;
    const chunks1 = buildChunksFromBlocks(blocks, DEFAULT_CHUNK_CONFIG, {
      docId: "doc-1",
      pipelineVersion: "chunk-v2.1.0",
    });
    const chunks2 = buildChunksFromBlocks(blocks, DEFAULT_CHUNK_CONFIG, {
      docId: "doc-1",
      pipelineVersion: "chunk-v2.1.0",
    });
    expect(chunks1[0].meta.chunkId).toBe(chunks2[0].meta.chunkId);
  });

  it("builds diff summary for before/after", () => {
    const before = buildChunksFromBlocks(buildDocumentBlocks("제 1 장\n내용 A").blocks, {
      ...DEFAULT_CHUNK_CONFIG,
      maxTokens: 30,
    });
    const after = buildChunksFromBlocks(
      buildDocumentBlocks("제 1 장\n내용 A\n내용 B\n내용 C").blocks,
      { ...DEFAULT_CHUNK_CONFIG, maxTokens: 15 }
    );
    const diff = buildChunkDiffSummary(before, after);
    expect(typeof diff.delta.chunkCount).toBe("number");
    expect(diff.after.chunkCount).toBe(after.length);
  });
});

describe("normalization and OCR quality", () => {
  it("extracts normalized deadline/deliverable/eval", () => {
    const normalized = normalizeConstraintInfo(
      "제출기한: 2026-03-10. 산출물: 제안서, 발표자료. 기술 40점 가격 60점."
    );
    expect((normalized.deadlines ?? []).length).toBeGreaterThan(0);
    expect((normalized.deliverables ?? []).length).toBeGreaterThan(0);
    expect((normalized.evalItems ?? []).length).toBeGreaterThan(0);
  });

  it("raises OCR warnings for noisy text", () => {
    const quality = estimateOcrQuality("� � ?!? ### @@ 본 문 서    이 상 합니다");
    const warnings = ocrWarningsFromQuality(quality);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

