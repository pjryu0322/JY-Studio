import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCLING_MARKDOWN_VALIDATOR_VERSION,
  buildTextSamples,
  charNgramSimilarity,
  compareJsonMarkdownSimilarity,
  extractJsonTextSamples,
  normalizeForSimilarity,
  tokenizeForSimilarity,
} from "../lib/adapters/docling/docling-json-markdown-similarity.ts";
import type { DoclingDocument } from "../lib/adapters/docling/docling-types.ts";

function makeDoc(texts: string[], name = "Sample Guide"): DoclingDocument {
  return {
    schema_name: "DoclingDocument",
    version: "1.10.0",
    name,
    origin: { filename: "sample-guide.pdf", mimetype: "application/pdf" },
    body: { children: [], self_ref: "#/body" },
    texts: texts.map((text, i) => ({
      self_ref: `#/texts/${i}`,
      text,
      label: "paragraph",
    })),
    tables: [],
    pictures: [],
  };
}

describe("docling-json-markdown-similarity", () => {
  it("exports validator version 2.0.0", () => {
    assert.equal(DOCLING_MARKDOWN_VALIDATOR_VERSION, "2.0.0");
  });

  it("normalizes punctuation and table pipes", () => {
    const normalized = normalizeForSimilarity("| Hello | World |\n| --- | --- |\n| A | B |");
    assert.ok(!normalized.includes("|"));
    assert.ok(normalized.includes("hello"));
    assert.ok(normalized.includes("world"));
  });

  it("caps tokenize length via token budget", () => {
    const many = Array.from({ length: 100 }, (_, i) => `token${i}`).join(" ");
    const tokens = tokenizeForSimilarity(many, 10);
    assert.equal(tokens.length, 10);
  });

  it("Korean spaced vs unspaced yields high char ngram similarity", () => {
    const a = "소프트웨어 사업 대가산정 가이드";
    const b = "소프트웨어사업대가산정가이드";
    const sim = charNgramSimilarity(a, b, 3);
    assert.ok(sim != null && sim >= 0.35);
  });

  it("table markdown vs plain cell text can pass sample coverage", () => {
    const jsonSamples = buildTextSamples(
      "Name Age Role Alice 30 Engineer Bob 25 Designer",
    );
    const markdownSamples = buildTextSamples(
      "| Name | Age | Role |\n| --- | --- | --- |\n| Alice | 30 | Engineer |\n| Bob | 25 | Designer |",
    );
    const result = compareJsonMarkdownSimilarity({
      jsonSamples,
      markdownSamples,
      document: makeDoc(["Alice 30 Engineer Bob 25 Designer"], "People"),
      originFileName: "people.pdf",
      sourceFileName: "people.pdf",
    });
    assert.notEqual(result.verdict, "ERROR");
    assert.ok(result.metrics.markdownCoverage >= 0.4 || result.metrics.passedSampleCount >= 1);
  });

  it("large corpus with overlapping markdown preview does not ERROR on low Jaccard alone", () => {
    const filler = Array.from({ length: 5000 }, (_, i) => `uniquephrase${i}xxx`).join(" ");
    const shared = "shared document alphabet beta gamma delta epsilon";
    const doc = makeDoc([filler, shared], "Large Doc");
    const jsonSamples = extractJsonTextSamples(doc);
    const markdownSamples = buildTextSamples(
      `# Large Doc\n\n${shared}\n\nMore shared document alphabet context.`,
    );
    const result = compareJsonMarkdownSimilarity({
      jsonSamples,
      markdownSamples,
      document: doc,
      originFileName: "large-doc.pdf",
      sourceFileName: "large-doc.pdf",
    });
    assert.notEqual(result.verdict, "ERROR");
    assert.ok(result.metrics.jaccard < 0.05 || result.verdict === "PASS" || result.verdict === "WARNING");
  });

  it("reports sample pass counts", () => {
    const shared = "alpha beta gamma delta epsilon zeta";
    const jsonSamples = {
      start: shared,
      middle: "totally different xxx yyy zzz",
      end: shared,
    };
    const markdownSamples = {
      start: shared,
      middle: "also unrelated qqq www eee",
      end: shared,
    };
    const result = compareJsonMarkdownSimilarity({
      jsonSamples,
      markdownSamples,
      document: makeDoc([shared]),
      originFileName: "sample.pdf",
      sourceFileName: "sample.pdf",
    });
    assert.equal(result.metrics.sampleCount, 3);
    assert.ok(result.metrics.passedSampleCount >= 2);
  });

  it("unrelated content still ERRORs when all evidence fails", () => {
    const doc = makeDoc(["Completely structured legal tax policy document"]);
    const result = compareJsonMarkdownSimilarity({
      jsonSamples: extractJsonTextSamples(doc),
      markdownSamples: buildTextSamples(
        "quantum banana robotics xyzzy entirely unrelated tokens",
      ),
      document: doc,
      originFileName: "a.pdf",
      sourceFileName: "b.pdf",
    });
    assert.equal(result.verdict, "ERROR");
    assert.ok(
      result.issues.some(
        (i) => i.code === "DOCLING_JSON_MARKDOWN_MISMATCH" && i.severity === "ERROR",
      ),
    );
  });
});
