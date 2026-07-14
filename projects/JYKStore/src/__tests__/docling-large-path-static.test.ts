import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "../..");

describe("validateAndNormalizeBundle large-file path (static)", () => {
  it("uses getObjectStream / sha256HexFromStream for large objects", () => {
    const service = readFileSync(
      join(root, "src/lib/docling-import/docling-import-service.ts"),
      "utf8",
    );
    const loader = readFileSync(
      join(root, "src/lib/docling-import/docling-bundle-stream-loader.ts"),
      "utf8",
    );
    const projector = readFileSync(
      join(root, "src/lib/adapters/docling/docling-json-stream-projector.ts"),
      "utf8",
    );

    assert.ok(service.includes("loadAndValidateDoclingBundlePayloads"));
    assert.ok(service.includes("normalizeDoclingDocument"));
    assert.ok(
      loader.includes("getObjectStream") && loader.includes("sha256HexFromStream"),
      "loader must stream-hash via getObjectStream + sha256HexFromStream",
    );
    assert.ok(loader.includes("projectDoclingJsonStream"));
    assert.ok(loader.includes("shouldUseDoclingJsonStreamProjector"));
    assert.ok(loader.includes("SOURCE_SIGNATURE_FULL_BUFFER_MAX_BYTES"));
    assert.ok(
      loader.includes("streamMarkdownTripleSamples") ||
        loader.includes("streamMarkdownPreviewFromReadable"),
      "loader must stream markdown samples/preview",
    );
    assert.ok(projector.includes("stream-json"));
    assert.ok(projector.includes("DOCLING_JSON_FULL_BUFFER_MAX_BYTES"));
    assert.ok(projector.includes("streamArray") || projector.includes("pick("));
    // Raw storage objects must not be rewritten after projection.
    assert.ok(!loader.includes("putSmallObject"));
    assert.ok(!loader.includes("put({"));
    // Stream projector must not assemble whole root into `assembled`.
    assert.ok(!/let assembled:\s*unknown/.test(projector));
  });
});
