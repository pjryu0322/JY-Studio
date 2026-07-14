import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import {
  projectDoclingJsonStream,
  shouldUseDoclingJsonStreamProjector,
  DOCLING_JSON_FULL_BUFFER_MAX_BYTES,
  compactDoclingDocument,
} from "../lib/adapters/docling/docling-json-stream-projector.ts";
import { normalizeDoclingDocument } from "../lib/adapters/docling/docling-normalizer.ts";
import { extractJsonTextSamples } from "../lib/adapters/docling/docling-json-markdown-similarity.ts";
import { validateDoclingParsedDocument } from "../lib/adapters/docling/docling-validator.ts";

const root = join(import.meta.dirname, "../..");

function buildLargeDoclingJson(targetBytes: number): string {
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

  it("source no longer assigns whole root via streamValues into assembled", () => {
    const source = readFileSync(
      join(root, "src/lib/adapters/docling/docling-json-stream-projector.ts"),
      "utf8",
    );
    assert.ok(source.includes("streamArray"), "must use streamArray for item paths");
    assert.ok(source.includes('pick({ filter:'), "must pick by path");
    assert.ok(source.includes("fanOutObjectStream"), "must fan-out token stream");
    assert.ok(
      !/\bassembled\s*=\s*item\.value\b/.test(source),
      "must not assign assembled = item.value from root streamValues",
    );
    assert.ok(
      !/let assembled:\s*unknown/.test(source),
      "must not declare assembled root accumulator",
    );
  });

  it("streams small Docling JSON path-wise and keeps text samples for similarity", async () => {
    const json = JSON.stringify({
      schema_name: "DoclingDocument",
      version: "1.10.0",
      name: "Sample",
      origin: { filename: "a.pdf", mimetype: "application/pdf" },
      body: { self_ref: "#/body", children: [{ $ref: "#/texts/0" }] },
      texts: [
        { self_ref: "#/texts/0", text: "START_MARKER " + "aaaa ".repeat(200), label: "paragraph" },
        { self_ref: "#/texts/1", text: "MIDDLE_MARKER " + "bbbb ".repeat(200), label: "paragraph" },
        { self_ref: "#/texts/2", text: "END_MARKER " + "cccc ".repeat(200), label: "paragraph" },
      ],
      tables: [],
      pictures: [
        {
          self_ref: "#/pictures/0",
          caption: "fig",
          image: { uri: "data:image/png;base64,QUJD", base64: "QUJD" },
        },
      ],
      groups: [],
    });

    const result = await projectDoclingJsonStream(Readable.from([json]));
    assert.equal(result.ok, true);
    assert.ok(result.document);
    assert.equal(result.document.schema_name, "DoclingDocument");
    assert.equal(result.document.origin?.filename, "a.pdf");
    assert.equal(result.document.pictures?.[0] && (result.document.pictures[0] as Record<string, unknown>).image, undefined);

    const samples = extractJsonTextSamples(result.document);
    assert.ok(samples.start.includes("START_MARKER") || samples.middle.includes("START_MARKER") || samples.end.includes("START_MARKER"));
    assert.ok(
      samples.start.includes("END_MARKER") ||
        samples.middle.includes("END_MARKER") ||
        samples.end.includes("END_MARKER"),
    );
  });

  it("compactDoclingDocument still works for in-memory small objects", () => {
    const doc = compactDoclingDocument({
      schema_name: "DoclingDocument",
      texts: [{ text: "hello" }],
      pictures: [{ self_ref: "#/pictures/0", image: { base64: "xx" } }],
    });
    assert.equal(doc.schema_name, "DoclingDocument");
    assert.equal((doc.pictures?.[0] as Record<string, unknown> | undefined)?.image, undefined);
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

    assert.ok(
      deltaMb < Buffer.byteLength(json) / (1024 * 1024),
      `heap delta ${deltaMb.toFixed(1)}MB unexpectedly high for ${(Buffer.byteLength(json) / (1024 * 1024)).toFixed(1)}MB JSON`,
    );
  });

  it("optional gated memory test for ~50MB synthetic stream", async (t) => {
    if (process.env.JYKSTORE_STREAM_PROJECTOR_MEM_TEST !== "1") {
      t.skip("set JYKSTORE_STREAM_PROJECTOR_MEM_TEST=1 to run");
      return;
    }
    const json = buildLargeDoclingJson(50 * 1024 * 1024);
    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    const result = await projectDoclingJsonStream(Readable.from([json]));
    global.gc?.();
    const after = process.memoryUsage().heapUsed;
    const deltaMb = (after - before) / (1024 * 1024);
    assert.equal(result.ok, true);
    assert.ok(
      deltaMb < 80,
      `heap delta ${deltaMb.toFixed(1)}MB too high for ~50MB stream (should not assemble root)`,
    );
  });
});
