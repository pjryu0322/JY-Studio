import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { InMemoryObjectStorage } from "../lib/object-storage/in-memory-object-storage.ts";
import { sha256Hex, sha256HexFromStream } from "../lib/object-storage/checksum.ts";
import { computePartCount, getDoclingUploadPolicy } from "../lib/docling-import/docling-upload-policy.ts";

describe("docling-upload-session in-memory multipart", () => {
  it("creates presigns, uploads parts, completes, and streams checksum", async () => {
    const storage = new InMemoryObjectStorage();
    const policy = getDoclingUploadPolicy({} as NodeJS.ProcessEnv);
    const objectKey = "payloads/pack-files/pack1/ver1/bundle1/DOCLING_JSON/file1.json";
    const payload = new TextEncoder().encode('{"schema_name":"DoclingDocument","version":"1"}');
    const partCount = computePartCount(payload.byteLength, policy.multipartPartBytes);
    assert.equal(partCount, 1);

    const { uploadId } = await storage.createMultipartUpload({
      objectKey,
      mimeType: "application/json",
    });

    const signed = await storage.presignUploadPart({
      objectKey,
      uploadId,
      partNumber: 1,
      expiresInSeconds: policy.presignedUrlTtlSeconds,
    });
    assert.ok(signed.url.startsWith("memory://"));
    assert.ok(signed.expiresAt instanceof Date);
    // Never treat URL as loggable secret in production paths.
    assert.ok(!signed.url.includes("secret"));

    const { etag } = storage.putPartViaPresign(signed.url, payload);
    const listed = await storage.listUploadedParts({ objectKey, uploadId });
    assert.equal(listed.parts.length, 1);
    assert.equal(listed.parts[0]!.etag, etag);

    await storage.completeMultipartUpload({
      objectKey,
      uploadId,
      parts: [{ partNumber: 1, etag }],
    });

    const head = await storage.headObject({ objectKey });
    assert.equal(head.exists, true);
    assert.equal(head.contentLength, payload.byteLength);

    const stream = await storage.getObjectStream({ objectKey });
    const checksum = await sha256HexFromStream(stream.body);
    assert.equal(checksum, sha256Hex(payload));
    assert.equal(checksum, createHash("sha256").update(payload).digest("hex"));
  });

  it("assembles multiple parts in order", async () => {
    const storage = new InMemoryObjectStorage();
    const objectKey = "payloads/pack-files/p/v/b/SOURCE_ORIGINAL/f.pdf";
    const part1 = new TextEncoder().encode("%PDF-1.7\nAAAA");
    const part2 = new TextEncoder().encode("BBBB");
    const { uploadId } = await storage.createMultipartUpload({ objectKey });

    const p1 = await storage.presignUploadPart({
      objectKey,
      uploadId,
      partNumber: 1,
      expiresInSeconds: 900,
    });
    const p2 = await storage.presignUploadPart({
      objectKey,
      uploadId,
      partNumber: 2,
      expiresInSeconds: 900,
    });
    const e1 = storage.putPartViaPresign(p1.url, part1).etag;
    const e2 = storage.putPartViaPresign(p2.url, part2).etag;

    await storage.completeMultipartUpload({
      objectKey,
      uploadId,
      parts: [
        { partNumber: 2, etag: e2 },
        { partNumber: 1, etag: e1 },
      ],
    });

    const got = await storage.getObject({ objectKey });
    assert.equal(Buffer.from(got.bytes).toString("utf8"), "%PDF-1.7\nAAAABBBB");
  });

  it("aborts multipart without leaving objects", async () => {
    const storage = new InMemoryObjectStorage();
    const objectKey = "payloads/tmp/abort.bin";
    const { uploadId } = await storage.createMultipartUpload({ objectKey });
    const signed = await storage.presignUploadPart({
      objectKey,
      uploadId,
      partNumber: 1,
      expiresInSeconds: 60,
    });
    storage.putPartViaPresign(signed.url, new Uint8Array([1, 2, 3]));
    await storage.abortMultipartUpload({ objectKey, uploadId });
    const head = await storage.headObject({ objectKey });
    assert.equal(head.exists, false);
  });
});
