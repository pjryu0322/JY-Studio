import type {
  PayloadObjectDescriptor,
  PayloadStorage,
  PayloadStorageGetResult,
  PayloadStorageHeadResult,
  PayloadStoragePutInput,
} from "@/lib/distribution/payload-storage";
import { buildPayloadObjectKey } from "@/lib/distribution/payload-storage-config";

/**
 * Test-only in-memory PayloadStorage. Never use as production default.
 */
export class InMemoryPayloadStorage implements PayloadStorage {
  readonly objects = new Map<
    string,
    { bytes: Uint8Array; checksumSha256: string; etag: string }
  >();

  prefix = "payloads";

  async put(input: PayloadStoragePutInput): Promise<PayloadObjectDescriptor> {
    const objectKey = buildPayloadObjectKey({
      prefix: this.prefix,
      packId: input.packId,
      versionId: input.versionId,
      payloadId: input.payloadId,
    });
    this.objects.set(objectKey, {
      bytes: input.bytes,
      checksumSha256: input.checksumSha256,
      etag: `"${input.checksumSha256.slice(0, 16)}"`,
    });
    return {
      objectKey,
      fileSize: input.bytes.byteLength,
      checksumSha256: input.checksumSha256,
      etag: `"${input.checksumSha256.slice(0, 16)}"`,
    };
  }

  async get(input: { objectKey: string }): Promise<PayloadStorageGetResult> {
    const row = this.objects.get(input.objectKey);
    if (!row) {
      throw new Error(`Missing object: ${input.objectKey}`);
    }
    return {
      bytes: row.bytes,
      contentLength: row.bytes.byteLength,
      etag: row.etag,
      checksumSha256Metadata: row.checksumSha256,
    };
  }

  async head(input: { objectKey: string }): Promise<PayloadStorageHeadResult> {
    const row = this.objects.get(input.objectKey);
    if (!row) return { exists: false };
    return {
      exists: true,
      contentLength: row.bytes.byteLength,
      etag: row.etag,
      checksumSha256Metadata: row.checksumSha256,
    };
  }

  async delete(input: { objectKey: string }): Promise<void> {
    this.objects.delete(input.objectKey);
  }
}
