import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateRetrievalEvaluationCases } from "@/lib/retrieval-evaluation/retrieval-evaluation-case-generator";
import { MAX_AUTO_RETRIEVAL_EVAL_CASES } from "@/lib/retrieval-evaluation/retrieval-evaluation-types";

describe("retrieval evaluation case generator", () => {
  it("creates case from required covered structure section", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [
        {
          sectionKey: "AUTH_FLOW",
          title: "인증 흐름",
          required: true,
          covered: true,
          matchedDocIds: ["doc-1"],
          matchedSignals: ["keyword:auth"],
        },
      ],
      sources: [],
      chunks: [],
    });
    assert.ok(cases.length >= 1);
    assert.ok(cases[0]!.expectedSections.includes("AUTH_FLOW"));
    assert.deepEqual(cases[0]!.expectedSourceDocumentIds, ["doc-1"]);
  });

  it("creates case from source document title", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [],
      sources: [
        {
          id: "doc-1",
          title: "OpenAPI paths guide",
          sourceType: "OPENAPI_SCHEMA",
          validationStatus: "PASS",
        },
      ],
      chunks: [],
    });
    assert.ok(cases.some((c) => c.expectedSourceDocumentIds.includes("doc-1")));
  });

  it("creates case from chunk title/tags", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [],
      sources: [],
      chunks: [
        {
          id: "chunk-1",
          title: "Callback retry",
          section: "webhooks",
          tags: ["callback", "retry"],
          sourceDocumentId: "doc-1",
          isActive: true,
          sourceType: "CALLBACK_GUIDE",
        },
      ],
    });
    assert.ok(cases.some((c) => c.expectedChunkIds.includes("chunk-1")));
  });

  it("skips cases without evidence", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [
        {
          sectionKey: "EMPTY",
          title: "빈 섹션",
          required: true,
          covered: true,
          matchedDocIds: [],
          matchedSignals: [],
        },
      ],
      sources: [],
      chunks: [],
    });
    // title/section keys still provide expectedSections evidence
    assert.ok(cases.every((c) => c.expectedSections.length > 0 || c.expectedChunkIds.length > 0));
  });

  it("dedupes normalized queries", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [],
      sources: [
        { id: "d1", title: "Same Title", sourceType: "FAQ", validationStatus: "PASS" },
        { id: "d2", title: "same   title", sourceType: "FAQ", validationStatus: "PASS" },
      ],
      chunks: [],
    });
    assert.equal(cases.length, 1);
  });

  it("respects max case limit", () => {
    const chunks = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      title: `Unique title number ${i} padding content`,
      section: `s${i}`,
      tags: [`t${i}`],
      sourceDocumentId: `d${i}`,
      isActive: true,
    }));
    const cases = generateRetrievalEvaluationCases({
      structureSections: [],
      sources: [],
      chunks,
      maxCases: 8,
    });
    assert.ok(cases.length <= 8);
    assert.ok(cases.length <= MAX_AUTO_RETRIEVAL_EVAL_CASES);
  });
});
