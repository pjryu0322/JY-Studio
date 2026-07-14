import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeFileFingerprint,
  DOCLING_FINGERPRINT_TAIL_SKIP_BYTES,
  sha256HexFallback,
  shouldSkipFingerprintTail,
  sha256HexOfArrayBuffer,
} from "../lib/docling-import/docling-upload-fingerprint.ts";

describe("docling upload fingerprint large-file path", () => {
  it("skips expensive tail hashing above threshold", () => {
    assert.equal(shouldSkipFingerprintTail(DOCLING_FINGERPRINT_TAIL_SKIP_BYTES), false);
    assert.equal(shouldSkipFingerprintTail(DOCLING_FINGERPRINT_TAIL_SKIP_BYTES + 1), true);
  });

  it("hashes only head for large synthetic blobs (tail mirrors head)", async () => {
    const size = DOCLING_FINGERPRINT_TAIL_SKIP_BYTES + 1024;
    const head = new Uint8Array(256 * 1024);
    head.fill(7);
    // Pretend tail differs — skip path must NOT read it.
    const fakeFile = {
      size,
      name: "huge.json",
      lastModified: 1,
      slice(start: number, end?: number) {
        const e = end ?? size;
        if (start === 0) {
          return {
            arrayBuffer: async () => head.buffer.slice(head.byteOffset, head.byteOffset + (e - start)),
          };
        }
        throw new Error(`tail slice should be skipped for large files (start=${start})`);
      },
    };
    const fp = await computeFileFingerprint(fakeFile as never);
    assert.equal(fp.size, size);
    assert.equal(fp.headSha256, fp.tailSha256);
    assert.equal(fp.headSha256, await sha256HexOfArrayBuffer(head));
  });

  it("still hashes distinct head/tail for mid-sized files", async () => {
    const slice = 256 * 1024;
    const size = slice + 64 * 1024; // > head slice, < tail-skip threshold
    const bytes = new Uint8Array(size);
    bytes.fill(1, 0, slice);
    bytes.fill(9, size - slice, size);
    const fakeFile = {
      size,
      name: "mid.json",
      lastModified: 2,
      slice(start: number, end?: number) {
        const e = end ?? size;
        const part = bytes.subarray(start, e);
        return {
          arrayBuffer: async () =>
            part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength),
        };
      },
    };
    const fp = await computeFileFingerprint(fakeFile as never);
    assert.notEqual(fp.headSha256, fp.tailSha256);
  });

  it("fallback SHA-256 matches Web Crypto when both available", async () => {
    const sample = new TextEncoder().encode("jykstore-fingerprint");
    const viaFallback = sha256HexFallback(sample);
    const viaApi = await sha256HexOfArrayBuffer(sample);
    assert.equal(viaFallback.length, 64);
    assert.equal(viaApi, viaFallback);
  });

  it("sha256HexOfArrayBuffer works even if subtle is temporarily missing", async () => {
    const sample = new Uint8Array([1, 2, 3, 4, 5]);
    const original = globalThis.crypto;
    const expected = sha256HexFallback(sample);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { subtle: undefined },
    });
    try {
      const got = await sha256HexOfArrayBuffer(sample);
      assert.equal(got, expected);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: original,
      });
    }
  });
});
