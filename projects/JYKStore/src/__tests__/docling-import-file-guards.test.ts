import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KnowledgePackFileRole } from "@prisma/client";
import {
  assertRoleFileAcceptable,
  detectMimeFromExtension,
  extensionOfFileName,
  sanitizeOriginalFileName,
} from "../lib/docling-import/docling-import-file-guards.ts";
import { isDoclingImportError } from "../lib/docling-import/docling-import-errors.ts";

describe("docling-import-file-guards", () => {
  it("sanitizes and strips path segments from file names", () => {
    assert.equal(sanitizeOriginalFileName("C:\\\\tmp\\\\doc.pdf"), "doc.pdf");
    assert.equal(sanitizeOriginalFileName("../../etc/passwd.pdf"), "passwd.pdf");
    assert.equal(extensionOfFileName("report.PDF"), ".pdf");
  });

  it("detects mime from extension", () => {
    assert.equal(detectMimeFromExtension(".pdf"), "application/pdf");
    assert.equal(detectMimeFromExtension(".json"), "application/json");
    assert.equal(detectMimeFromExtension(".md"), "text/markdown");
  });

  it("accepts valid role files with content validation", async () => {
    const source = await assertRoleFileAcceptable(
      KnowledgePackFileRole.SOURCE_ORIGINAL,
      "sample.pdf",
      "application/pdf",
      new TextEncoder().encode("%PDF-1.7\ncontent"),
    );
    assert.equal(source.extension, ".pdf");
    assert.equal(source.mimeType, "application/pdf");

    const json = await assertRoleFileAcceptable(
      KnowledgePackFileRole.DOCLING_JSON,
      "sample.json",
      null,
      new TextEncoder().encode("{}"),
    );
    assert.equal(json.mimeType, "application/json");

    const md = await assertRoleFileAcceptable(
      KnowledgePackFileRole.DOCLING_MARKDOWN,
      "sample.md",
      "text/plain",
      new TextEncoder().encode("# hi"),
    );
    assert.equal(md.mimeType, "text/plain");
  });

  it("rejects empty, blocked, wrong-role, and signature mismatch", async () => {
    await assert.rejects(
      () =>
        assertRoleFileAcceptable(
          KnowledgePackFileRole.SOURCE_ORIGINAL,
          "a.pdf",
          null,
          new Uint8Array(),
        ),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_FILE_REQUIRED",
    );
    await assert.rejects(
      () =>
        assertRoleFileAcceptable(
          KnowledgePackFileRole.SOURCE_ORIGINAL,
          "evil.exe",
          null,
          new Uint8Array([1]),
        ),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_BLOCKED_EXTENSION",
    );
    await assert.rejects(
      () =>
        assertRoleFileAcceptable(
          KnowledgePackFileRole.DOCLING_JSON,
          "sample.pdf",
          null,
          new Uint8Array([1]),
        ),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_INVALID_JSON",
    );
    await assert.rejects(
      () =>
        assertRoleFileAcceptable(
          KnowledgePackFileRole.SOURCE_ORIGINAL,
          "sample.pdf",
          "application/pdf",
          new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
        ),
      (e) => isDoclingImportError(e) && e.code === "DOCLING_FILE_SIGNATURE_MISMATCH",
    );
  });

  it("allows application/octet-stream when signature matches", async () => {
    const source = await assertRoleFileAcceptable(
      KnowledgePackFileRole.SOURCE_ORIGINAL,
      "sample.pdf",
      "application/octet-stream",
      new TextEncoder().encode("%PDF-1.4\n"),
    );
    assert.equal(source.mimeType, "application/pdf");
  });
});
