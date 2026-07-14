import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import {
  projectDoclingJsonStream,
  shouldUseDoclingJsonStreamProjector,
  DOCLING_JSON_FULL_BUFFER_MAX_BYTES,
} from "../lib/adapters/docling/docling-json-stream-projector.ts";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import { validateDoclingParsedDocument } from "../lib/adapters/docling/docling-validator.ts";

function buildLargeDoclingJson(targetBytes: number): string {
  // Mostly nested pictures with fake base64 so ignore-filter savings are measurable.
  const fakeBase64 = "A".repeat(256 * 1024);
  const header = `{"schema_name":"DoclingDocument","version":"1.10.0","name":"LargeStreamDoc","origin":{"filename":"large.pdf","mimetype":"application/pdf"},"body":{"self_ref":"#/body","children":[{"$ref":"#/texts/0"}]},"texts":[{"self_ref":"#/texts/0","text":"Hello world sample content","label":"paragraph"}],"tables":[],"pictures":[`;
  const footer = `],"groups":[]}`;

  const parts: string[] = [header];
  let written = Buffer.byteLength(header) + Buffer.byteLength(footer);
  let i = 0;
  while (written < targetBytes) {
    const item = `${i > 0 ? "," : ""}{"self_ref":"#/pictures/${i}","caption":"fig ${i}","prov":[{"page_no":1,"bbox":{"l":0,"t":0,"r":1,"b":1}}],"image":{"uri":"data:image/png;base64,${fakeBase64}","base64":"${fakeBase64}"}}`;
    parts.push(item);
    written += Buffer.byteLength(item);
    i += 1;
    if (i > 50_000) break;
  }
  parts.push(footer);
  return parts.join("");
}

describe("docling-json-stream-projector", () => {
  it("gates full-buffer path at 16MiB", () => {
    assert.equal(shouldUseDoclingJsonStreamProjector(DOCLING_JSON_FULL_BUFFER_MAX_BYTES), false);
    assert.equal(shouldUseDoclingJsonStreamProjector(DOCLING_JSON_FULL_BUFFER_MAX_BYTES + 1), true);
    assert.equal(shouldUseDoclingJsonStreamProjector(null), true);
  });

  it("streams ~5–10MB Docling JSON, strips base64, and normalizes", async () => {
    const json = buildLargeDoclingJson(6 * 1024 * 1024);
    assert.ok(Buffer.byteLength(json) >= 5 * 1024 * 1024);

    const before = process.memoryUsage().heapUsed;
    const result = await projectDoclingJsonStream(Readable.from([json]), {
      contentLength: Buffer.byteLength(json),
    });
    const after = process.memoryUsage().heapUsed;
    const deltaMb = (after - before) / (1024 * 1024);

    assert.equal(result.ok, true);
    assert.ok(result.document);
    assert.equal(result.document.schema_name, "DoclingDocument");
    assert.equal(result.document.version, "1.10.0");
    assert.equal(result.document.name, "LargeStreamDoc");
    assert.ok((result.document.texts?.length ?? 0) > 0);
    assert.ok((result.document.pictures?.length ?? 0) >= 1);

    const picture = result.document.pictures![0] as Record<string, unknown>;
    assert.equal(picture.image, undefined);
    assert.equal(picture.base64, undefined);
    assert.equal(picture.uri, undefined);
    const serialized = JSON.stringify(result.document);
    assert.ok(!serialized.includes("A".repeat(1000)), "base64 payload must be stripped");
    assert.ok(
      Buffer.byteLength(serialized) < Buffer.byteLength(json) / 5,
      `projected ${Buffer.byteLength(serialized)} should be << raw ${Buffer.byteLength(json)}`,
    );

    const validated = validateDoclingParsedDocument(result.document, {
      source: { filename: "large.pdf", mimetype: "application/pdf" },
    });
    assert.equal(validated.ok, true);

    const draft = normalizeDoclingDocument(validated.document!, {
      files: { sourceFileId: "s1", jsonPayloadFileId: "j1", markdownPayloadFileId: "m1" },
    });
    assert.ok(draft.title);
    assert.ok(draft.sections.length > 0);
    assert.ok(draft.figures.length >= 1);

    // Soft memory bound for CI: heap growth should stay well below the raw JSON size.
    assert.ok(
      deltaMb < Buffer.byteLength(json) / (1024 * 1024),
      `heap delta ${deltaMb.toFixed(1)}MB unexpectedly high for ${(Buffer.byteLength(json) / (1024 * 1024)).toFixed(1)}MB JSON`,
    );
  });
});
