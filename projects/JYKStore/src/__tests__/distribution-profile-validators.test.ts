import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { validateZipBytes } from "../lib/distribution/payload-zip-validator.ts";
import { validatePayloadProfile } from "../lib/distribution/payload-profile-validator.ts";

async function buildZip(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "uint8array" });
}

async function entriesOf(bytes: Uint8Array) {
  const result = await validateZipBytes(bytes);
  assert.equal(result.ok, true, result.errors.join("; "));
  return result.entries;
}

describe("payload-profile-validators", () => {
  describe("docling-chunks-v1", () => {
    it("accepts valid chunks.jsonl", async () => {
      const bytes = await buildZip({
        "payload/chunks.jsonl": [
          JSON.stringify({ text: "alpha" }),
          JSON.stringify({ text: "beta" }),
          "",
        ].join("\n"),
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("docling-chunks-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, true);
      assert.equal(result.entrypoint, "payload/chunks.jsonl");
      assert.equal(result.recordCount, 2);
      assert.equal(result.errors.length, 0);
    });

    it("rejects invalid JSONL", async () => {
      const bytes = await buildZip({
        "payload/chunks.jsonl": "{not-json\n",
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("docling-chunks-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => /invalid json/i.test(e)));
    });

    it("rejects missing entrypoint", async () => {
      const bytes = await buildZip({
        "payload/readme.txt": "no entrypoint",
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("docling-chunks-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => /entrypoint/i.test(e)));
    });

    it("rejects empty JSONL records", async () => {
      const bytes = await buildZip({
        "payload/chunks.jsonl": "\n\n",
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("docling-chunks-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => /empty/i.test(e)));
    });
  });

  describe("unstructured-elements-v1", () => {
    it("accepts valid elements.json", async () => {
      const bytes = await buildZip({
        "payload/elements.json": JSON.stringify([
          { type: "Title", text: "Hello" },
          { type: "NarrativeText", text: "World" },
        ]),
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("unstructured-elements-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, true);
      assert.equal(result.entrypoint, "payload/elements.json");
      assert.equal(result.recordCount, 2);
    });

    it("rejects non-array JSON", async () => {
      const bytes = await buildZip({
        "payload/elements.json": JSON.stringify({ type: "Title", text: "x" }),
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("unstructured-elements-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => /array/i.test(e)));
    });

    it("rejects elements without type", async () => {
      const bytes = await buildZip({
        "payload/elements.json": JSON.stringify([{ text: "only text" }]),
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("unstructured-elements-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => /type/i.test(e)));
    });

    it("rejects entirely empty text content", async () => {
      const bytes = await buildZip({
        "payload/elements.json": JSON.stringify([
          { type: "Title", text: "" },
          { type: "NarrativeText", text: "   " },
        ]),
      });
      const zipEntries = await entriesOf(bytes);
      const result = await validatePayloadProfile("unstructured-elements-v1", {
        zipEntries,
        zipBytes: bytes,
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => /lack extractable/i.test(e)));
    });
  });

  it("rejects unsupported profiles", async () => {
    const result = await validatePayloadProfile("custom-v1", {
      zipEntries: [],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /unsupported/i.test(e)));
  });

  it("rejects generator/profile mismatch", async () => {
    const result = await validatePayloadProfile(
      "docling-chunks-v1",
      { zipEntries: [{ path: "payload/chunks.jsonl", uncompressedSize: 1 }] },
      { generatorType: "UNSTRUCTURED" },
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /does not match/i.test(e)));
  });
});
