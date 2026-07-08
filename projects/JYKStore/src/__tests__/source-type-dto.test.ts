import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateSourceValidation } from "@/lib/source-type-dto";

describe("evaluateSourceValidation", () => {
  it("returns FAIL when title is missing", () => {
    const result = evaluateSourceValidation({
      title: "  ",
      sourceType: "PRODUCT_MANUAL",
      sourceFormat: "TEXT",
      content: "body",
    });
    assert.equal(result.status, "FAIL");
  });

  it("returns FAIL when content and sourceUrl are both missing", () => {
    const result = evaluateSourceValidation({
      title: "Doc",
      sourceType: "API_SPEC",
      sourceFormat: "TEXT",
    });
    assert.equal(result.status, "FAIL");
  });

  it("returns WARNING for SAMPLE_CODE without productVersion", () => {
    const result = evaluateSourceValidation({
      title: "Sample",
      sourceType: "SAMPLE_CODE",
      sourceFormat: "CODE",
      content: "console.log(1)",
    });
    assert.equal(result.status, "WARNING");
  });

  it("returns WARNING for OPENAPI_SCHEMA with TEXT format", () => {
    const result = evaluateSourceValidation({
      title: "Schema",
      sourceType: "OPENAPI_SCHEMA",
      sourceFormat: "TEXT",
      content: "{}",
    });
    assert.equal(result.status, "WARNING");
  });

  it("returns WARNING for ERROR_CODE_TABLE with JSON format", () => {
    const result = evaluateSourceValidation({
      title: "Errors",
      sourceType: "ERROR_CODE_TABLE",
      sourceFormat: "JSON",
      content: "[]",
    });
    assert.equal(result.status, "WARNING");
  });

  it("returns PASS for PRODUCT_MANUAL with TEXT and content", () => {
    const result = evaluateSourceValidation({
      title: "Manual",
      sourceType: "PRODUCT_MANUAL",
      sourceFormat: "TEXT",
      content: "Overview",
    });
    assert.equal(result.status, "PASS");
  });
});
