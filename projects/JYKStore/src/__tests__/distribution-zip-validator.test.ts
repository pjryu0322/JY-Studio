import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { validateZipBytes } from "../lib/distribution/payload-zip-validator.ts";

async function zipBytes(
  files: Record<string, string | Uint8Array>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const buffer = await zip.generateAsync({ type: "uint8array" });
  return buffer;
}

describe("payload-zip-validator", () => {
  it("accepts a normal ZIP", async () => {
    const bytes = await zipBytes({
      "payload/chunks.jsonl": '{"text":"hello"}\n',
      "README.md": "# ok\n",
    });
    const result = await validateZipBytes(bytes);
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.ok(result.entries.some((e) => e.path === "payload/chunks.jsonl"));
  });

  it("rejects empty bytes", async () => {
    const result = await validateZipBytes(new Uint8Array());
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /empty/i.test(e)));
  });

  it("rejects path traversal entries", async () => {
    const bytes = await zipBytes({ "../evil.txt": "x" });
    const result = await validateZipBytes(bytes);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => /traversal|relative path|\.\./i.test(e)),
      result.errors.join("; "),
    );
  });

  it("rejects absolute paths", async () => {
    const bytes = await zipBytes({ "/etc/passwd": "x" });
    const result = await validateZipBytes(bytes);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /absolute/i.test(e)));
  });

  it("rejects drive-letter paths", async () => {
    const bytes = await zipBytes({ "C:/windows/system32/evil.txt": "x" });
    const result = await validateZipBytes(bytes);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => /drive-letter|absolute path/i.test(e)),
      result.errors.join("; "),
    );
  });

  it("rejects forbidden executable extensions", async () => {
    const bytes = await zipBytes({ "payload/tool.exe": "MZ" });
    const result = await validateZipBytes(bytes);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /\.exe/i.test(e)));
  });

  it("rejects duplicate paths (case-insensitive)", async () => {
    const bytes = await zipBytes({
      "payload/A.txt": "one",
      "payload/a.txt": "two",
    });
    const result = await validateZipBytes(bytes);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /duplicate/i.test(e)));
  });

  it("rejects too many entries", async () => {
    const zip = new JSZip();
    for (let i = 0; i < 4; i++) {
      zip.file(`payload/f${i}.txt`, "x");
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await validateZipBytes(bytes, { maxEntries: 3 });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /too many entries/i.test(e)));
  });

  it("rejects oversized single entry", async () => {
    const oversized = new Uint8Array(64);
    oversized.fill(1);
    const bytes = await zipBytes({ "payload/big.bin": oversized });
    const result = await validateZipBytes(bytes, { maxSingleEntryBytes: 32 });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /single-entry/i.test(e)));
  });

  it("rejects oversized unpacked total", async () => {
    const bytes = await zipBytes({
      "payload/a.txt": "aaaa",
      "payload/b.txt": "bbbb",
    });
    const result = await validateZipBytes(bytes, { maxUnpackedBytes: 4 });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /unpacked size/i.test(e)));
  });

  it("surfaces encrypted ZIP load failures", async () => {
    // Minimal central-directory-like garbage that mentions encryption when JSZip throws,
    // or a ZIP with encryption bit set. Craft a tiny invalid encrypted local header.
    // Local file header signature + flag bit 0 set:
    const crafted = Uint8Array.from([
      0x50, 0x4b, 0x03, 0x04, // local file header
      0x14, 0x00, // version
      0x01, 0x00, // general purpose bit flag: encrypted
      0x00, 0x00, // compression
      0x00, 0x00, 0x00, 0x00, // time/date
      0x00, 0x00, 0x00, 0x00, // crc
      0x00, 0x00, 0x00, 0x00, // compressed size
      0x00, 0x00, 0x00, 0x00, // uncompressed size
      0x01, 0x00, // file name length
      0x00, 0x00, // extra length
      0x61, // name "a"
    ]);
    const result = await validateZipBytes(crafted);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  });
});
