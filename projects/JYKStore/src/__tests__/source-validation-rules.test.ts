import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSourceDocumentContent } from "@/lib/source-validation/source-validation-runner";
import type { SourceValidationDocumentInput } from "@/lib/source-validation/source-validation-types";

function baseDoc(overrides: Partial<SourceValidationDocumentInput> = {}): SourceValidationDocumentInput {
  return {
    title: "Integration guide title",
    sourceType: "PRODUCT_MANUAL",
    sourceFormat: "MARKDOWN",
    content: "This document has enough body text for baseline validation rules.",
    sourceUrl: null,
    checksum: null,
    productVersion: null,
    ...overrides,
  };
}

describe("source validation rules", () => {
  it("fails when title is missing", () => {
    const result = validateSourceDocumentContent(baseDoc({ title: "  " }));
    assert.equal(result.status, "FAIL");
    assert.ok(result.issues.some((i) => i.code === "TITLE_REQUIRED"));
  });

  it("fails when content and sourceUrl are missing", () => {
    const result = validateSourceDocumentContent(
      baseDoc({ content: "", sourceUrl: null }),
    );
    assert.equal(result.status, "FAIL");
    assert.ok(result.issues.some((i) => i.code === "CONTENT_OR_URL_REQUIRED"));
  });

  it("fails when sourceUrl is invalid", () => {
    const result = validateSourceDocumentContent(
      baseDoc({ content: "", sourceUrl: "not-a-url" }),
    );
    assert.equal(result.status, "FAIL");
    assert.ok(result.issues.some((i) => i.code === "SOURCE_URL_INVALID"));
  });

  it("fails when secret pattern is detected", () => {
    const result = validateSourceDocumentContent(
      baseDoc({ content: "Demo config api_key=sk-live-abcdefghijklmnop" }),
    );
    assert.equal(result.status, "FAIL");
    assert.ok(result.issues.some((i) => i.code === "SENSITIVE_SECRET_DETECTED"));
  });

  it("warns on email pattern", () => {
    const result = validateSourceDocumentContent(
      baseDoc({
        content: "Contact support at help@example.com for integration questions and setup.",
      }),
    );
    assert.equal(result.status, "WARNING");
    assert.ok(result.issues.some((i) => i.code === "POTENTIAL_PERSONAL_DATA"));
  });

  it("warns when SAMPLE_CODE has no productVersion", () => {
    const result = validateSourceDocumentContent(
      baseDoc({
        sourceType: "SAMPLE_CODE",
        sourceFormat: "CODE",
        content: "const x = 1;\n// java spring node kotlin sample",
        productVersion: null,
      }),
    );
    assert.ok(result.issues.some((i) => i.code === "SAMPLE_CODE_PRODUCT_VERSION"));
    assert.equal(result.status, "WARNING");
  });

  it("fails when OPENAPI_JSON does not parse", () => {
    const result = validateSourceDocumentContent(
      baseDoc({
        sourceType: "OPENAPI_SCHEMA",
        sourceFormat: "OPENAPI_JSON",
        content: "{ not valid json",
      }),
    );
    assert.equal(result.status, "FAIL");
    assert.ok(result.issues.some((i) => i.code === "OPENAPI_JSON_PARSE_FAIL"));
  });

  it("warns when OPENAPI JSON has no paths", () => {
    const result = validateSourceDocumentContent(
      baseDoc({
        sourceType: "OPENAPI_SCHEMA",
        sourceFormat: "OPENAPI_JSON",
        content: JSON.stringify({ openapi: "3.0.0", info: { title: "t", version: "1" } }),
      }),
    );
    assert.ok(result.issues.some((i) => i.code === "OPENAPI_PATHS_MISSING"));
    assert.notEqual(result.status, "PASS");
  });

  it("warns when ERROR_CODE_TABLE lacks error code pattern", () => {
    const result = validateSourceDocumentContent(
      baseDoc({
        sourceType: "ERROR_CODE_TABLE",
        sourceFormat: "MARKDOWN",
        content: "Generic failure descriptions without numeric codes listed here.",
      }),
    );
    assert.ok(result.issues.some((i) => i.code === "ERROR_CODE_PATTERN_MISSING"));
  });

  it("warns when CALLBACK_GUIDE lacks payload/retry/security hints", () => {
    const result = validateSourceDocumentContent(
      baseDoc({
        sourceType: "CALLBACK_GUIDE",
        sourceFormat: "MARKDOWN",
        content: "We will call your callback URL when events happen in the system.",
      }),
    );
    assert.ok(result.issues.some((i) => i.code === "CALLBACK_PAYLOAD_HINT"));
    assert.ok(result.issues.some((i) => i.code === "CALLBACK_RETRY_HINT"));
    assert.ok(result.issues.some((i) => i.code === "CALLBACK_SECURITY_HINT"));
  });

  it("warns when checksum duplicates a sibling in the same version", () => {
    const result = validateSourceDocumentContent(
      baseDoc({ checksum: "abc123checksum" }),
      { packId: "pack-1", versionId: "ver-1", siblingChecksums: ["abc123checksum"] },
    );
    assert.ok(result.issues.some((i) => i.code === "CHECKSUM_DUPLICATE"));
  });

  it("does not warn on checksum duplicate when checksum is absent", () => {
    const result = validateSourceDocumentContent(
      baseDoc({ checksum: null }),
      { packId: "pack-1", versionId: "ver-1", siblingChecksums: ["abc123checksum"] },
    );
    assert.equal(
      result.issues.some((i) => i.code === "CHECKSUM_DUPLICATE"),
      false,
    );
  });
});
