import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSourceValidationReleaseGate } from "@/lib/release-gate/release-gate-runner";

function doc(
  overrides: Partial<{
    id: string;
    title: string;
    validationStatus: string;
    updatedAt: string;
  }> = {},
) {
  return {
    id: "doc-1",
    title: "Doc",
    validationStatus: "PASS",
    updatedAt: "2026-07-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("release gate source validation", () => {
  it("blocks when no source documents", () => {
    const { issues } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [],
      latestReportsByDocumentId: {},
    });
    assert.ok(issues.some((i) => i.code === "SOURCE_DOCUMENT_MISSING"));
  });

  it("blocks NOT_CHECKED", () => {
    const { issues } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [doc({ validationStatus: "NOT_CHECKED" })],
      latestReportsByDocumentId: {},
    });
    assert.ok(issues.some((i) => i.code === "SOURCE_VALIDATION_NOT_CHECKED"));
  });

  it("blocks FAIL status", () => {
    const { issues } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [doc({ validationStatus: "FAIL" })],
      latestReportsByDocumentId: {},
    });
    assert.ok(issues.some((i) => i.code === "SOURCE_VALIDATION_FAILED"));
  });

  it("blocks PASS without report", () => {
    const { issues } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [doc({ validationStatus: "PASS" })],
      latestReportsByDocumentId: {},
    });
    assert.ok(issues.some((i) => i.code === "SOURCE_VALIDATION_REPORT_MISSING"));
  });

  it("blocks stale report after document update", () => {
    const { issues } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [
        doc({
          validationStatus: "PASS",
          updatedAt: "2026-07-08T12:00:00.000Z",
        }),
      ],
      latestReportsByDocumentId: {
        "doc-1": { status: "PASS", checkedAt: "2026-07-08T10:00:00.000Z" },
      },
    });
    assert.ok(issues.some((i) => i.code === "SOURCE_VALIDATION_REPORT_STALE"));
  });

  it("blocks status mismatch", () => {
    const { issues } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [doc({ validationStatus: "PASS" })],
      latestReportsByDocumentId: {
        "doc-1": { status: "WARNING", checkedAt: "2026-07-08T12:00:00.000Z" },
      },
    });
    assert.ok(issues.some((i) => i.code === "SOURCE_VALIDATION_STATUS_MISMATCH"));
  });

  it("passes with PASS and current report", () => {
    const { issues, sectionStatus } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [doc({ validationStatus: "PASS" })],
      latestReportsByDocumentId: {
        "doc-1": { status: "PASS", checkedAt: "2026-07-08T12:00:00.000Z" },
      },
    });
    assert.equal(issues.length, 0);
    assert.equal(sectionStatus, "PASS");
  });

  it("WARNING section when document is WARNING", () => {
    const { sectionStatus } = evaluateSourceValidationReleaseGate({
      sourceDocuments: [doc({ validationStatus: "WARNING" })],
      latestReportsByDocumentId: {
        "doc-1": { status: "WARNING", checkedAt: "2026-07-08T12:00:00.000Z" },
      },
    });
    assert.equal(sectionStatus, "WARNING");
  });
});
