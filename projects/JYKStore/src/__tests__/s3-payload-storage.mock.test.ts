import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapS3StorageError, classifyS3StorageError } from "../lib/distribution/s3-storage-error.ts";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { S3PayloadStorage } from "../lib/distribution/s3-payload-storage.ts";
import type { PayloadS3StorageConfig } from "../lib/distribution/payload-storage-config.ts";

function mockClient(handlers: {
  send: (command: { constructor: { name: string }; input?: Record<string, unknown> }) => Promise<unknown>;
}) {
  return {
    send: handlers.send,
  };
}

describe("S3 storage error mapping", () => {
  it("maps NoSuchKey to PAYLOAD_NOT_FOUND", () => {
    const err = mapS3StorageError({ name: "NoSuchKey", $metadata: { httpStatusCode: 404 } }, "get");
    assert.equal(err.code, "PAYLOAD_NOT_FOUND");
    assert.equal(err.httpStatus, 404);
  });

  it("maps AccessDenied to PAYLOAD_STORAGE_ACCESS_DENIED", () => {
    const err = mapS3StorageError({ name: "AccessDenied", $metadata: { httpStatusCode: 403 } }, "get");
    assert.equal(err.code, "PAYLOAD_STORAGE_ACCESS_DENIED");
    assert.equal(err.httpStatus, 503);
  });

  it("maps NoSuchBucket and 5xx to UNAVAILABLE", () => {
    assert.equal(classifyS3StorageError({ name: "NoSuchBucket" }), "bucket-missing");
    const err = mapS3StorageError({ name: "TimeoutError", $metadata: { httpStatusCode: 503 } }, "put");
    assert.equal(err.code, "PAYLOAD_STORAGE_UNAVAILABLE");
  });

  it("preserves existing PayloadServiceError from get path", async () => {
    const config: PayloadS3StorageConfig = {
      driver: "s3",
      region: "ap-northeast-2",
      bucket: "bucket",
      accessKeyId: "ak",
      secretAccessKey: "sk",
      forcePathStyle: true,
      prefix: "payloads",
      serverSideEncryption: undefined,
    };
    const storage = new S3PayloadStorage(config);
    (storage as unknown as { client: unknown }).client = mockClient({
      send: async () => {
        throw new PayloadServiceError(
          "PAYLOAD_OBJECT_INTEGRITY_FAILED",
          "integrity",
          503,
        );
      },
    });
    await assert.rejects(
      () => storage.get({ objectKey: "payloads/a/b/c.zip" }),
      (error: unknown) =>
        error instanceof PayloadServiceError && error.code === "PAYLOAD_OBJECT_INTEGRITY_FAILED",
    );
  });

  it("head returns exists false only for not-found", async () => {
    const config: PayloadS3StorageConfig = {
      driver: "s3",
      region: "ap-northeast-2",
      bucket: "bucket",
      accessKeyId: "ak",
      secretAccessKey: "sk",
      forcePathStyle: true,
      prefix: "payloads",
      serverSideEncryption: undefined,
    };
    const storage = new S3PayloadStorage(config);
    (storage as unknown as { client: unknown }).client = mockClient({
      send: async () => {
        const error = Object.assign(new Error("missing"), {
          name: "NotFound",
          $metadata: { httpStatusCode: 404 },
        });
        throw error;
      },
    });
    const missing = await storage.head({ objectKey: "missing.zip" });
    assert.equal(missing.exists, false);

    (storage as unknown as { client: unknown }).client = mockClient({
      send: async () => {
        throw Object.assign(new Error("denied"), {
          name: "AccessDenied",
          $metadata: { httpStatusCode: 403 },
        });
      },
    });
    await assert.rejects(
      () => storage.head({ objectKey: "secret.zip" }),
      (error: unknown) =>
        error instanceof PayloadServiceError && error.code === "PAYLOAD_STORAGE_ACCESS_DENIED",
    );
  });

  it("put sends metadata checksum and object key", async () => {
    const config: PayloadS3StorageConfig = {
      driver: "s3",
      region: "ap-northeast-2",
      bucket: "bucket",
      accessKeyId: "ak",
      secretAccessKey: "sk",
      forcePathStyle: true,
      prefix: "payloads",
      serverSideEncryption: "AES256",
    };
    const storage = new S3PayloadStorage(config);
    let captured: Record<string, unknown> | null = null;
    (storage as unknown as { client: unknown }).client = mockClient({
      send: async (command) => {
        captured = (command as { input: Record<string, unknown> }).input;
        return { ETag: '"etag"' };
      },
    });
    const bytes = new TextEncoder().encode("zip-bytes");
    const result = await storage.put({
      packId: "pack1",
      versionId: "ver1",
      payloadId: "pay1",
      originalFileName: "a.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256: "a".repeat(64),
    });
    assert.equal(result.objectKey, "payloads/pack1/ver1/pay1.zip");
    assert.ok(captured);
    assert.equal(captured!.Key, "payloads/pack1/ver1/pay1.zip");
    assert.equal((captured!.Metadata as Record<string, string>)["jyk-checksum-sha256"], "a".repeat(64));
    assert.equal(captured!.ServerSideEncryption, "AES256");
  });
});
