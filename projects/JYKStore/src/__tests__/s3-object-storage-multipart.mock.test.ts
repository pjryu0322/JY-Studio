import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { S3ObjectStorage } from "../lib/object-storage/s3-object-storage.ts";
import type { ObjectS3StorageConfig } from "../lib/object-storage/object-storage-config.ts";
import { Readable } from "node:stream";

function mockClient(handlers: {
  send: (command: { constructor: { name: string }; input?: Record<string, unknown> }) => Promise<unknown>;
}) {
  return { send: handlers.send };
}

const baseConfig: ObjectS3StorageConfig = {
  driver: "s3",
  region: "ap-northeast-2",
  bucket: "bucket",
  accessKeyId: "ak",
  secretAccessKey: "sk",
  forcePathStyle: true,
  prefix: "payloads",
  serverSideEncryption: "AES256",
};

describe("S3ObjectStorage multipart mocks", () => {
  it("createMultipartUpload returns uploadId", async () => {
    const storage = new S3ObjectStorage(baseConfig);
    (storage as unknown as { client: unknown }).client = mockClient({
      send: async (command) => {
        assert.equal(command.constructor.name, "CreateMultipartUploadCommand");
        return { UploadId: "upload-1" };
      },
    });
    const result = await storage.createMultipartUpload({
      objectKey: "payloads/a/b.json",
      mimeType: "application/json",
    });
    assert.equal(result.uploadId, "upload-1");
  });

  it("complete and abort multipart send expected commands", async () => {
    const storage = new S3ObjectStorage(baseConfig);
    const seen: string[] = [];
    (storage as unknown as { client: unknown }).client = mockClient({
      send: async (command) => {
        seen.push(command.constructor.name);
        if (command.constructor.name === "CompleteMultipartUploadCommand") {
          return { ETag: '"final"' };
        }
        return {};
      },
    });
    const completed = await storage.completeMultipartUpload({
      objectKey: "k",
      uploadId: "u",
      parts: [
        { partNumber: 2, etag: '"b"' },
        { partNumber: 1, etag: '"a"' },
      ],
    });
    assert.equal(completed.etag, '"final"');
    await storage.abortMultipartUpload({ objectKey: "k", uploadId: "u" });
    assert.deepEqual(seen, [
      "CompleteMultipartUploadCommand",
      "AbortMultipartUploadCommand",
    ]);
  });

  it("getObjectStream returns body stream without buffering helpers", async () => {
    const storage = new S3ObjectStorage(baseConfig);
    const body = Readable.from([Buffer.from("stream-bytes")]);
    (storage as unknown as { client: unknown }).client = mockClient({
      send: async (command) => {
        assert.equal(command.constructor.name, "GetObjectCommand");
        return {
          Body: body,
          ContentLength: 12,
          ETag: '"e"',
          Metadata: {},
        };
      },
    });
    const result = await storage.getObjectStream({ objectKey: "k" });
    assert.equal(result.contentLength, 12);
    const chunks: Buffer[] = [];
    for await (const chunk of result.body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    assert.equal(Buffer.concat(chunks).toString("utf8"), "stream-bytes");
  });

  it("listUploadedParts paginates", async () => {
    const storage = new S3ObjectStorage(baseConfig);
    let calls = 0;
    (storage as unknown as { client: unknown }).client = mockClient({
      send: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            Parts: [{ PartNumber: 1, ETag: '"a"', Size: 10 }],
            IsTruncated: true,
            NextPartNumberMarker: "1",
          };
        }
        return {
          Parts: [{ PartNumber: 2, ETag: '"b"', Size: 10 }],
          IsTruncated: false,
        };
      },
    });
    const listed = await storage.listUploadedParts({ objectKey: "k", uploadId: "u" });
    assert.equal(listed.parts.length, 2);
    assert.equal(listed.parts[1]!.partNumber, 2);
  });
});
