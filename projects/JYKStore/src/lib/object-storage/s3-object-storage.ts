import { Readable } from "node:stream";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  isPayloadServiceError,
  PayloadServiceError,
} from "@/lib/distribution/payload-errors";
import {
  describeS3StorageProbeError,
  isS3ObjectNotFoundError,
  mapS3StorageError,
} from "@/lib/object-storage/s3-storage-error";
import {
  buildPayloadObjectKey,
  requireObjectStorageConfig,
  type ObjectS3StorageConfig,
} from "@/lib/object-storage/object-storage-config";
import type {
  AbortMultipartUploadInput,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadResult,
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

const META_CHECKSUM = "jyk-checksum-sha256";
const META_PACK_ID = "jyk-pack-id";
const META_VERSION_ID = "jyk-version-id";
const META_PAYLOAD_ID = "jyk-payload-id";

function createS3Client(config: ObjectS3StorageConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
    // AWS SDK v3 defaults enable flexible CRC32 checksums on UploadPart, which
    // pollute browser presigned URLs (x-amz-checksum-*) and break MinIO PUT/CORS.
    // Keep checksums only when the API requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }
  return new S3Client(clientConfig);
}

async function streamToUint8Array(
  body: { transformToByteArray?: () => Promise<Uint8Array> } | Uint8Array | undefined,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  if (body instanceof Uint8Array) return body;
  if (typeof body.transformToByteArray === "function") {
    return body.transformToByteArray();
  }
  throw new PayloadServiceError(
    "PAYLOAD_OBJECT_INTEGRITY_FAILED",
    "Object Storage 응답을 읽지 못했습니다.",
    503,
  );
}

function asNodeReadable(body: unknown): Readable {
  if (!body) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_INTEGRITY_FAILED",
      "Object Storage 스트림이 비어 있습니다.",
      503,
    );
  }
  if (body instanceof Readable) return body;
  if (typeof (body as { pipe?: unknown }).pipe === "function") {
    return body as Readable;
  }
  // Web ReadableStream fallback (should be rare in Node AWS SDK).
  if (typeof Readable.fromWeb === "function" && typeof (body as { getReader?: unknown }).getReader === "function") {
    return Readable.fromWeb(body as import("node:stream/web").ReadableStream);
  }
  throw new PayloadServiceError(
    "PAYLOAD_OBJECT_INTEGRITY_FAILED",
    "Object Storage 응답을 스트림으로 열지 못했습니다.",
    503,
  );
}

export class S3ObjectStorage implements ObjectStorageBackend {
  readonly config: ObjectS3StorageConfig;
  private readonly client: S3Client;

  constructor(config: ObjectS3StorageConfig = requireObjectStorageConfig()) {
    this.config = config;
    this.client = createS3Client(config);
  }

  get prefix(): string {
    return this.config.prefix;
  }

  async putSmallObject(input: PutSmallObjectInput): Promise<StoredObjectDescriptor> {
    const objectKey =
      input.objectKey ??
      buildPayloadObjectKey({
        prefix: this.config.prefix,
        packId: input.packId,
        versionId: input.versionId,
        payloadId: input.payloadId,
      });

    try {
      const result = await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
          Body: Buffer.from(input.bytes),
          ContentType: input.mimeType,
          ContentLength: input.bytes.byteLength,
          Metadata: {
            [META_CHECKSUM]: input.checksumSha256,
            [META_PACK_ID]: input.packId,
            [META_VERSION_ID]: input.versionId,
            [META_PAYLOAD_ID]: input.payloadId,
          },
          ...(this.config.serverSideEncryption
            ? { ServerSideEncryption: this.config.serverSideEncryption }
            : {}),
        }),
      );

      return {
        objectKey,
        fileSize: input.bytes.byteLength,
        checksumSha256: input.checksumSha256,
        etag: result.ETag ?? null,
        versionId: result.VersionId ?? null,
      };
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "put");
    }
  }

  /** @deprecated Prefer putSmallObject — kept for ZIP KnowledgePayload paths. */
  put(input: PutSmallObjectInput): Promise<StoredObjectDescriptor> {
    return this.putSmallObject(input);
  }

  async getObject(input: { objectKey: string }): Promise<ObjectStorageGetResult> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
        }),
      );
      const bytes = await streamToUint8Array(result.Body as never);
      return {
        bytes,
        contentLength: result.ContentLength ?? bytes.byteLength,
        etag: result.ETag ?? null,
        checksumSha256Metadata: result.Metadata?.[META_CHECKSUM] ?? null,
      };
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "get");
    }
  }

  /** @deprecated Prefer getObject for small objects; use getObjectStream for large. */
  get(input: { objectKey: string }): Promise<ObjectStorageGetResult> {
    return this.getObject(input);
  }

  async getObjectStream(input: { objectKey: string }): Promise<ObjectStorageStreamResult> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
        }),
      );
      // Large-object path: never call transformToByteArray.
      const body = asNodeReadable(result.Body);
      return {
        body,
        contentLength: result.ContentLength ?? 0,
        etag: result.ETag ?? null,
        checksumSha256Metadata: result.Metadata?.[META_CHECKSUM] ?? null,
      };
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "get");
    }
  }

  async headObject(input: { objectKey: string }): Promise<ObjectStorageHeadResult> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
        }),
      );
      return {
        exists: true,
        contentLength: result.ContentLength,
        etag: result.ETag ?? null,
        checksumSha256Metadata: result.Metadata?.[META_CHECKSUM] ?? null,
      };
    } catch (error) {
      if (isS3ObjectNotFoundError(error, "head")) return { exists: false };
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "head");
    }
  }

  head(input: { objectKey: string }): Promise<ObjectStorageHeadResult> {
    return this.headObject(input);
  }

  async deleteObject(input: { objectKey: string }): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
        }),
      );
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "delete");
    }
  }

  delete(input: { objectKey: string }): Promise<void> {
    return this.deleteObject(input);
  }

  async createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<CreateMultipartUploadResult> {
    try {
      const result = await this.client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
          ContentType: input.mimeType,
          Metadata: input.metadata,
          ...(this.config.serverSideEncryption
            ? { ServerSideEncryption: this.config.serverSideEncryption }
            : {}),
        }),
      );
      if (!result.UploadId) {
        throw new PayloadServiceError(
          "PAYLOAD_STORAGE_UNAVAILABLE",
          "Multipart upload id가 비어 있습니다.",
          503,
        );
      }
      return { uploadId: result.UploadId };
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "createMultipartUpload");
    }
  }

  async presignUploadPart(input: PresignUploadPartInput): Promise<PresignUploadPartResult> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
        UploadId: input.uploadId,
        PartNumber: input.partNumber,
        // Explicitly omit Checksum* fields so getSignedUrl does not hoist CRC32 query params.
      });
      const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
      const url = await getSignedUrl(this.client, command, {
        expiresIn: input.expiresInSeconds,
        // Never require browser to send SDK flexible-checksum headers.
        unhoistableHeaders: new Set([
          "x-amz-checksum-crc32",
          "x-amz-checksum-crc32c",
          "x-amz-checksum-sha1",
          "x-amz-checksum-sha256",
          "x-amz-sdk-checksum-algorithm",
          "x-amz-checksum-algorithm",
        ]),
      });
      if (/[?&]x-amz-checksum-/i.test(url) || /[?&]x-amz-sdk-checksum-algorithm=/i.test(url)) {
        throw new PayloadServiceError(
          "PAYLOAD_STORAGE_UNAVAILABLE",
          "Presigned UploadPart URL에 체크섬 쿼리가 포함되어 브라우저 업로드가 실패합니다.",
          503,
        );
      }
      // Never log `url` — it is a capability bearer token.
      return { url, expiresAt };
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "presignUploadPart");
    }
  }

  async listUploadedParts(input: ListUploadedPartsInput): Promise<ListUploadedPartsResult> {
    try {
      const parts: ListUploadedPartsResult["parts"] = [];
      let partNumberMarker: string | undefined;
      let isTruncated = true;
      while (isTruncated) {
        const page = await this.client.send(
          new ListPartsCommand({
            Bucket: this.config.bucket,
            Key: input.objectKey,
            UploadId: input.uploadId,
            PartNumberMarker: partNumberMarker,
          }),
        );
        for (const part of page.Parts ?? []) {
          if (part.PartNumber == null || !part.ETag) continue;
          parts.push({
            partNumber: part.PartNumber,
            etag: part.ETag,
            size: part.Size,
          });
        }
        isTruncated = Boolean(page.IsTruncated);
        partNumberMarker = page.NextPartNumberMarker;
      }
      return { parts };
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "listUploadedParts");
    }
  }

  async completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadResult> {
    try {
      const result = await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
          UploadId: input.uploadId,
          MultipartUpload: {
            Parts: input.parts
              .slice()
              .sort((a, b) => a.partNumber - b.partNumber)
              .map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
          },
        }),
      );
      return { etag: result.ETag ?? null, versionId: result.VersionId ?? null };
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "completeMultipartUpload");
    }
  }

  async abortMultipartUpload(input: AbortMultipartUploadInput): Promise<void> {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
          UploadId: input.uploadId,
        }),
      );
    } catch (error) {
      if (isPayloadServiceError(error)) throw error;
      throw mapS3StorageError(error, "abortMultipartUpload");
    }
  }

  async headBucket(): Promise<boolean> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    return true;
  }
}

/** @deprecated Prefer S3ObjectStorage. */
export const S3PayloadStorage = S3ObjectStorage;

export async function probeObjectStorage(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{
  ok: boolean;
  configured: boolean;
  bucketOk: boolean;
  errors: string[];
  summary?: Record<string, unknown>;
}> {
  const { parseObjectStorageConfig, describeObjectStorageConfig } = await import(
    "@/lib/object-storage/object-storage-config"
  );
  const parsed = parseObjectStorageConfig(env);
  if (!parsed.ok) {
    return {
      ok: false,
      configured: false,
      bucketOk: false,
      errors: ["Object Storage is not configured"],
    };
  }

  try {
    const storage = new S3ObjectStorage(parsed.config);
    await storage.headBucket();
    return {
      ok: true,
      configured: true,
      bucketOk: true,
      errors: [],
      summary: describeObjectStorageConfig(parsed.config),
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      bucketOk: false,
      errors: [describeS3StorageProbeError(error)],
      summary: describeObjectStorageConfig(parsed.config),
    };
  }
}

/** @deprecated Prefer probeObjectStorage. */
export const probePayloadObjectStorage = probeObjectStorage;
