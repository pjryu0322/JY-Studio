import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateRetrievalEvaluationCases } from "@/lib/retrieval-evaluation/retrieval-evaluation-case-generator";
import { MAX_AUTO_RETRIEVAL_EVAL_CASES } from "@/lib/retrieval-evaluation/retrieval-evaluation-types";

describe("retrieval evaluation case generator", () => {
  it("creates case from required covered structure section when active chunk covers source", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [
        {
          sectionKey: "AUTH_FLOW",
          title: "인증 흐름",
          required: true,
          covered: true,
          matchedDocIds: ["doc-1"],
          matchedSignals: ["keyword:auth flow"],
        },
      ],
      sources: [
        {
          id: "doc-1",
          title: "Auth guide",
          sourceType: "SECURITY_GUIDE",
          validationStatus: "PASS",
        },
      ],
      chunks: [
        {
          id: "chunk-auth",
          title: "인증 흐름 설명",
          section: "AUTH_FLOW",
          tags: ["auth"],
          sourceDocumentId: "doc-1",
          isActive: true,
          sourceType: "SECURITY_GUIDE",
        },
      ],
    });
    assert.ok(cases.length >= 1);
    assert.ok(
      cases.some(
        (c) =>
          c.expectedSourceDocumentIds.includes("doc-1") ||
          c.expectedChunkIds.includes("chunk-auth"),
      ),
    );
  });

  it("creates case from source document title when covered by active chunk", () => {
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
      chunks: [
        {
          id: "chunk-1",
          title: "OpenAPI paths",
          section: "paths",
          tags: ["openapi"],
          sourceDocumentId: "doc-1",
          isActive: true,
          sourceType: "OPENAPI_SCHEMA",
        },
      ],
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

  it("skips structure cases without active source coverage", () => {
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
    assert.equal(cases.length, 0);
  });

  it("skips banned bare queries like api/error", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [
        {
          sectionKey: "API",
          title: "API",
          required: true,
          covered: true,
          matchedDocIds: ["doc-1"],
          matchedSignals: ["keyword:api"],
        },
      ],
      sources: [
        { id: "doc-1", title: "Manual", sourceType: "PRODUCT_MANUAL", validationStatus: "PASS" },
      ],
      chunks: [
        {
          id: "c1",
          title: "설치하기",
          section: "Install",
          tags: [],
          sourceDocumentId: "doc-1",
          isActive: true,
          sourceType: "PRODUCT_MANUAL",
        },
      ],
    });
    assert.ok(!cases.some((c) => c.query.toLowerCase() === "api"));
  });

  it("dedupes normalized queries", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [],
      sources: [
        { id: "d1", title: "Same Title", sourceType: "FAQ", validationStatus: "PASS" },
      ],
      chunks: [
        {
          id: "c1",
          title: "Same Title",
          section: "s",
          tags: [],
          sourceDocumentId: "d1",
          isActive: true,
          sourceType: "FAQ",
        },
        {
          id: "c2",
          title: "same   title",
          section: "s2",
          tags: [],
          sourceDocumentId: "d1",
          isActive: true,
          sourceType: "FAQ",
        },
      ],
    });
    assert.equal(cases.filter((c) => normalizeLike(c.query) === "same title").length, 1);
  });

  it("respects max case limit", () => {
    const chunks = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      title: `Unique title number ${i} padding content`,
      section: `s${i}`,
      tags: [`t${i}`],
      sourceDocumentId: `d${i}`,
      isActive: true,
      sourceType: "FAQ",
    }));
    const cases = generateRetrievalEvaluationCases({
      structureSections: [],
      sources: [],
      chunks,
      maxCases: MAX_AUTO_RETRIEVAL_EVAL_CASES,
    });
    assert.ok(cases.length <= MAX_AUTO_RETRIEVAL_EVAL_CASES);
  });
});

function normalizeLike(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}
