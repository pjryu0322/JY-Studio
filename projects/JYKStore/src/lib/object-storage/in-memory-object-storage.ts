import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { buildPayloadObjectKey } from "@/lib/object-storage/object-storage-config";
import type {
  AbortMultipartUploadInput,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadResult,
  CopyObjectInput,
  CreateMultipartUploadInput,
  CreateMultipartUploadResult,
  ListUploadedPartsInput,
  ListUploadedPartsResult,
  ObjectStorageBackend,
  ObjectStorageGetResult,
  ObjectStorageHeadResult,
  ObjectStorageStreamResult,
  PresignUploadPartInput,
  PresignUploadPartResult,
  PutSmallObjectInput,
  StoredObjectDescriptor,
} from "@/lib/object-storage/object-storage";

type StoredObject = {
  bytes: Uint8Array;
  checksumSha256: string;
  etag: string;
};

type MultipartState = {
  objectKey: string;
  mimeType?: string;
  metadata?: Record<string, string>;
  parts: Map<number, { bytes: Uint8Array; etag: string }>;
};

/**
 * Test-only in-memory ObjectStorage with multipart support.
 * Never use as production default.
 */
export class InMemoryObjectStorage implements ObjectStorageBackend {
  readonly objects = new Map<string, StoredObject>();
  readonly multiparts = new Map<string, MultipartState>();

  prefix = "payloads";

  async putSmallObject(input: PutSmallObjectInput): Promise<StoredObjectDescriptor> {
    const objectKey =
      input.objectKey ??
      buildPayloadObjectKey({
        prefix: this.prefix,
        packId: input.packId,
        versionId: input.versionId,
        payloadId: input.payloadId,
      });
    const etag = `"${input.checksumSha256.slice(0, 16)}"`;
    this.objects.set(objectKey, {
      bytes: input.bytes,
      checksumSha256: input.checksumSha256,
      etag,
    });
    return {
      objectKey,
      fileSize: input.bytes.byteLength,
      checksumSha256: input.checksumSha256,
      etag,
    };
  }

  put(input: PutSmallObjectInput): Promise<StoredObjectDescriptor> {
    return this.putSmallObject(input);
  }

  async getObject(input: { objectKey: string }): Promise<ObjectStorageGetResult> {
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

  get(input: { objectKey: string }): Promise<ObjectStorageGetResult> {
    return this.getObject(input);
  }

  async getObjectStream(input: {
    objectKey: string;
    range?: { start: number; end?: number };
  }): Promise<ObjectStorageStreamResult> {
    const got = await this.getObject({ objectKey: input.objectKey });
    const total = got.contentLength;
    if (!input.range) {
      return {
        body: Readable.from([Buffer.from(got.bytes)]),
        contentLength: total,
        etag: got.etag,
        checksumSha256Metadata: got.checksumSha256Metadata,
      };
    }
    const start = Math.max(0, input.range.start);
    const end =
      input.range.end != null
        ? Math.min(total - 1, input.range.end)
        : Math.max(0, total - 1);
    if (start >= total || start > end) {
      return {
        body: Readable.from([]),
        contentLength: 0,
        etag: got.etag,
        checksumSha256Metadata: got.checksumSha256Metadata,
        contentRange: `bytes */${total}`,
        partial: true,
      };
    }
    const slice = Buffer.from(got.bytes.subarray(start, end + 1));
    return {
      body: Readable.from([slice]),
      contentLength: slice.byteLength,
      etag: got.etag,
      checksumSha256Metadata: got.checksumSha256Metadata,
      contentRange: `bytes ${start}-${end}/${total}`,
      partial: true,
    };
  }

  async headObject(input: { objectKey: string }): Promise<ObjectStorageHeadResult> {
    const row = this.objects.get(input.objectKey);
    if (!row) return { exists: false };
    return {
      exists: true,
      contentLength: row.bytes.byteLength,
      etag: row.etag,
      checksumSha256Metadata: row.checksumSha256,
    };
  }

  head(input: { objectKey: string }): Promise<ObjectStorageHeadResult> {
    return this.headObject(input);
  }

  async deleteObject(input: { objectKey: string }): Promise<void> {
    this.objects.delete(input.objectKey);
  }

  delete(input: { objectKey: string }): Promise<void> {
    return this.deleteObject(input);
  }

  async copyObject(input: CopyObjectInput): Promise<StoredObjectDescriptor> {
    const existingDest = this.objects.get(input.destinationObjectKey);
    if (existingDest) {
      if (
        existingDest.checksumSha256 === input.expectedChecksumSha256 &&
        existingDest.bytes.byteLength === input.expectedSizeBytes
      ) {
        return {
          objectKey: input.destinationObjectKey,
          fileSize: existingDest.bytes.byteLength,
          checksumSha256: existingDest.checksumSha256,
          etag: existingDest.etag,
        };
      }
      throw new Error(
        `Destination object already exists with different bytes: ${input.destinationObjectKey}`,
      );
    }
    const source = this.objects.get(input.sourceObjectKey);
    if (!source) {
      throw new Error(`Missing source object: ${input.sourceObjectKey}`);
    }
    if (source.bytes.byteLength !== input.expectedSizeBytes) {
      throw new Error("Source object size does not match expectedSizeBytes");
    }
    if (source.checksumSha256 !== input.expectedChecksumSha256) {
      throw new Error("Source object checksum does not match expectedChecksumSha256");
    }
    // In-memory copy of the byte array reference is fine for tests; production uses S3 CopyObject.
    const copied = new Uint8Array(source.bytes);
    const etag = `"${input.expectedChecksumSha256.slice(0, 16)}"`;
    this.objects.set(input.destinationObjectKey, {
      bytes: copied,
      checksumSha256: input.expectedChecksumSha256,
      etag,
    });
    return {
      objectKey: input.destinationObjectKey,
      fileSize: copied.byteLength,
      checksumSha256: input.expectedChecksumSha256,
      etag,
    };
  }

  async createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<CreateMultipartUploadResult> {
    const uploadId = `mem-${randomUUID()}`;
    this.multiparts.set(uploadId, {
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      metadata: input.metadata,
      parts: new Map(),
    });
    return { uploadId };
  }

  /**
   * In-memory presign: returns a synthetic URL that putPartViaPresign can use in tests.
   * Never log the URL in production paths.
   */
  async presignUploadPart(input: PresignUploadPartInput): Promise<PresignUploadPartResult> {
    const state = this.multiparts.get(input.uploadId);
    if (!state || state.objectKey !== input.objectKey) {
      throw new Error(`Unknown multipart upload: ${input.uploadId}`);
    }
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const url = `memory://multipart/${input.uploadId}/${input.partNumber}`;
    return { url, expiresAt };
  }

  /** Test helper — simulate client PUT to a memory:// presigned URL. */
  putPartViaPresign(url: string, bytes: Uint8Array): { etag: string; partNumber: number } {
    const match = /^memory:\/\/multipart\/([^/]+)\/(\d+)$/.exec(url);
    if (!match) {
      throw new Error(`Invalid memory presign URL`);
    }
    const uploadId = match[1]!;
    const partNumber = Number.parseInt(match[2]!, 10);
    const state = this.multiparts.get(uploadId);
    if (!state) throw new Error(`Unknown multipart upload: ${uploadId}`);
    const etag = `"${createHash("md5").update(bytes).digest("hex")}"`;
    state.parts.set(partNumber, { bytes, etag });
    return { etag, partNumber };
  }

  async listUploadedParts(input: ListUploadedPartsInput): Promise<ListUploadedPartsResult> {
    const state = this.multiparts.get(input.uploadId);
    if (!state || state.objectKey !== input.objectKey) {
      throw new Error(`Unknown multipart upload: ${input.uploadId}`);
    }
    const parts = [...state.parts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([partNumber, part]) => ({
        partNumber,
        etag: part.etag,
        size: part.bytes.byteLength,
      }));
    return { parts };
  }

  async completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadResult> {
    const state = this.multiparts.get(input.uploadId);
    if (!state || state.objectKey !== input.objectKey) {
      throw new Error(`Unknown multipart upload: ${input.uploadId}`);
    }
    const ordered = input.parts.slice().sort((a, b) => a.partNumber - b.partNumber);
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (const part of ordered) {
      const stored = state.parts.get(part.partNumber);
      if (!stored || stored.etag !== part.etag) {
        throw new Error(`Missing or mismatched part ${part.partNumber}`);
      }
      chunks.push(stored.bytes);
      total += stored.bytes.byteLength;
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const etag = `"${checksumSha256.slice(0, 16)}"`;
    this.objects.set(input.objectKey, { bytes, checksumSha256, etag });
    this.multiparts.delete(input.uploadId);
    return { etag, versionId: null };
  }

  async abortMultipartUpload(input: AbortMultipartUploadInput): Promise<void> {
    const state = this.multiparts.get(input.uploadId);
    if (state && state.objectKey !== input.objectKey) {
      throw new Error(`Multipart object key mismatch`);
    }
    this.multiparts.delete(input.uploadId);
  }
}

/** @deprecated Prefer InMemoryObjectStorage. */
export const InMemoryPayloadStorage = InMemoryObjectStorage;
