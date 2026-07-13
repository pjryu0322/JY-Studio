import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectFileSignature } from "../lib/docling-import/file-signature-detector.ts";

describe("file-signature-detector", () => {
  it("detects PDF", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n...");
    const d = detectFileSignature(bytes);
    assert.equal(d.kind, "PDF");
    assert.equal(d.confidence, "high");
    assert.equal(d.mimeType, "application/pdf");
  });

  it("detects PNG", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);
    assert.equal(detectFileSignature(bytes).kind, "PNG");
  });

  it("detects JPEG", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    assert.equal(detectFileSignature(bytes).kind, "JPEG");
  });

  it("detects TIFF LE/BE", () => {
    assert.equal(
      detectFileSignature(new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0, 0])).kind,
      "TIFF",
    );
    assert.equal(
      detectFileSignature(new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0, 0])).kind,
      "TIFF",
    );
  });

  it("detects ZIP", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    assert.equal(detectFileSignature(bytes).kind, "ZIP");
  });

  it("detects HTML and JSON text", () => {
    assert.equal(
      detectFileSignature(new TextEncoder().encode("<!DOCTYPE html><html></html>")).kind,
      "HTML",
    );
    assert.equal(
      detectFileSignature(new TextEncoder().encode('{"a":1}')).kind,
      "JSON",
    );
  });

  it("returns UNKNOWN for binary EXE-like bytes", () => {
    const bytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0]);
    assert.equal(detectFileSignature(bytes).kind, "UNKNOWN");
  });
});
