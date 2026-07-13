import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import {
  isPayloadServiceError,
  PayloadServiceError,
} from "@/lib/distribution/payload-errors";
import {
  describeS3StorageProbeError,
  isS3ObjectNotFoundError,
  mapS3StorageError,
} from "@/lib/distribution/s3-storage-error";
import {
  buildPayloadObjectKey,
  requirePayloadStorageConfig,
  type PayloadS3StorageConfig,
} from "@/lib/distribution/payload-storage-config";
import type {
  PayloadObjectDescriptor,
  PayloadStorage,
  PayloadStorageGetResult,
  PayloadStorageHeadResult,
  PayloadStoragePutInput,
} from "@/lib/distribution/payload-storage";

const META_CHECKSUM = "jyk-checksum-sha256";
const META_PACK_ID = "jyk-pack-id";
const META_VERSION_ID = "jyk-version-id";
const META_PAYLOAD_ID = "jyk-payload-id";

function createS3Client(config: PayloadS3StorageConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
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

export class S3PayloadStorage implements PayloadStorage {
  readonly config: PayloadS3StorageConfig;
  private readonly client: S3Client;

  constructor(config: PayloadS3StorageConfig = requirePayloadStorageConfig()) {
    this.config = config;
    this.client = createS3Client(config);
  }

  async put(input: PayloadStoragePutInput): Promise<PayloadObjectDescriptor> {
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

  async get(input: { objectKey: string }): Promise<PayloadStorageGetResult> {
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

  async head(input: { objectKey: string }): Promise<PayloadStorageHeadResult> {
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

  async delete(input: { objectKey: string }): Promise<void> {
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

  async headBucket(): Promise<boolean> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    return true;
  }
}

export async function probePayloadObjectStorage(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{
  ok: boolean;
  configured: boolean;
  bucketOk: boolean;
  errors: string[];
  summary?: Record<string, unknown>;
}> {
  const { parsePayloadStorageConfig, describePayloadStorageConfig } = await import(
    "@/lib/distribution/payload-storage-config"
  );
  const parsed = parsePayloadStorageConfig(env);
  if (!parsed.ok) {
    return {
      ok: false,
      configured: false,
      bucketOk: false,
      errors: ["Object Storage is not configured"],
    };
  }

  try {
    const storage = new S3PayloadStorage(parsed.config);
    await storage.headBucket();
    return {
      ok: true,
      configured: true,
      bucketOk: true,
      errors: [],
      summary: describePayloadStorageConfig(parsed.config),
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      bucketOk: false,
      errors: [describeS3StorageProbeError(error)],
      summary: describePayloadStorageConfig(parsed.config),
    };
  }
}
