import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sha256Hex } from "../lib/distribution/payload-checksum.ts";

describe("payload-checksum", () => {
  it("returns 64-char lowercase hex for the same bytes", () => {
    const bytes = new TextEncoder().encode("jyk-payload-fixture");
    const a = sha256Hex(bytes);
    const b = sha256Hex(bytes);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it("changes when bytes change", () => {
    const a = sha256Hex(new TextEncoder().encode("alpha"));
    const b = sha256Hex(new TextEncoder().encode("beta"));
    assert.notEqual(a, b);
  });

  it("matches known SHA-256 vector for empty input", () => {
    assert.equal(
      sha256Hex(new Uint8Array()),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
