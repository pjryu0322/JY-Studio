import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("review submit evidence RAG Export download binding", () => {
  it("accepts exportFingerprint as downloadTest.fileId for RAG_EXPORT", () => {
    const src = readFileSync(
      join(root, "src/lib/distribution/review-submit-evidence.ts"),
      "utf8",
    );
    assert.ok(src.includes('downloadMode === "RAG_EXPORT"'));
    assert.ok(src.includes("exportFingerprint"));
    assert.ok(src.includes("downloadTest.fileId !== expectedExportId"));
    assert.ok(
      src.includes("sourceFile && downloadTest.fileId !== sourceFile.id"),
      "legacy SOURCE_ORIGINAL binding must remain for non-RAG downloads",
    );
  });
});
