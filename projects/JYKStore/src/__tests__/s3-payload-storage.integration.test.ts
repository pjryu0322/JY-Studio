import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { S3PayloadStorage } from "../lib/distribution/s3-payload-storage.ts";
import { sha256Hex } from "../lib/distribution/payload-checksum.ts";
import { resetPayloadStorageCache } from "../lib/distribution/payload-storage-factory.ts";

const endpoint = process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim();
const bucket = process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim();
const accessKeyId = process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim();
const region = process.env.JYKSTORE_PAYLOAD_S3_REGION?.trim() || "ap-northeast-2";

const configured = Boolean(endpoint && bucket && accessKeyId && secretAccessKey);

describe("S3/MinIO payload storage integration", () => {
  it(configured ? "put head get delete roundtrip against MinIO" : "skipped without MinIO env", async (t) => {
    if (!configured) {
      t.skip("Set JYKSTORE_PAYLOAD_S3_* to a running MinIO (see test/docker-compose.minio.yml)");
      return;
    }

    resetPayloadStorageCache();
    const storage = new S3PayloadStorage({
      driver: "s3",
      endpoint,
      region,
      bucket: bucket!,
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      forcePathStyle: true,
      prefix: "payloads-test",
      // MinIO SSE may require extra config; leave unset for local integration.
      serverSideEncryption: undefined,
    });

    const bytes = new TextEncoder().encode(`minio-roundtrip-${Date.now()}`);
    const checksumSha256 = sha256Hex(bytes);
    const put = await storage.put({
      packId: "pack_minio",
      versionId: "ver_minio",
      payloadId: `pay_${Date.now()}`,
      originalFileName: "fixture.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256,
    });

    const head = await storage.head({ objectKey: put.objectKey });
    assert.equal(head.exists, true);
    assert.equal(head.checksumSha256Metadata, checksumSha256);

    const got = await storage.get({ objectKey: put.objectKey });
    assert.equal(sha256Hex(got.bytes), checksumSha256);

    await storage.delete({ objectKey: put.objectKey });
    const missing = await storage.head({ objectKey: put.objectKey });
    assert.equal(missing.exists, false);
  });
});
