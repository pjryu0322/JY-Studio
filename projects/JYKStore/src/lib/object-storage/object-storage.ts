import type { Readable } from "node:stream";

export type StoredObjectDescriptor = {
  /** S3 object key (DB column storagePath / storageKey stores this value). */
  objectKey: string;
  fileSize: number;
  checksumSha256: string;
  etag?: string | null;
  versionId?: string | null;
};

export type PutSmallObjectInput = {
  packId: string;
  versionId: string;
  payloadId: string;
  originalFileName: string;
  mimeType: string;
  bytes: Uint8Array;
  checksumSha256: string;
  /** When set, stores under this key instead of the ZIP payload key. */
  objectKey?: string;
};

export type ObjectStorageGetResult = {
  bytes: Uint8Array;
  contentLength: number;
  etag?: string | null;
  checksumSha256Metadata?: string | null;
};

export type ObjectStorageByteRange = {
  start: number;
  /** Inclusive end byte offset. Omit for open-ended range. */
  end?: number;
};

export type ObjectStorageStreamResult = {
  /** Node.js readable stream of object bytes — do not buffer entire body. */
  body: Readable;
  /** Length of this response body (partial when Range applied). */
  contentLength: number;
  etag?: string | null;
  checksumSha256Metadata?: string | null;
  /** Present when a Range request was satisfied (e.g. bytes 0-1023/5000). */
  contentRange?: string | null;
  /** True when body is a partial object (HTTP 206). */
  partial?: boolean;
};

export type ObjectStorageHeadResult = {
  exists: boolean;
  contentLength?: number;
  etag?: string | null;
  checksumSha256Metadata?: string | null;
};

export type CreateMultipartUploadInput = {
  objectKey: string;
  mimeType?: string;
  metadata?: Record<string, string>;
};

export type CreateMultipartUploadResult = {
  uploadId: string;
};

export type PresignUploadPartInput = {
  objectKey: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds: number;
};

export type PresignUploadPartResult = {
  url: string;
  expiresAt: Date;
};

export type UploadedPart = {
  partNumber: number;
  etag: string;
  size?: number;
};

export type ListUploadedPartsInput = {
  objectKey: string;
  uploadId: string;
};

export type ListUploadedPartsResult = {
  parts: UploadedPart[];
};

export type CompleteMultipartUploadInput = {
  objectKey: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
};

export type CompleteMultipartUploadResult = {
  etag?: string | null;
  versionId?: string | null;
};

export type AbortMultipartUploadInput = {
  objectKey: string;
  uploadId: string;
};

/**
 * S3-compatible object store. Prefer streaming + multipart for large objects.
 * putSmallObject / getObject are for tests and tiny objects only.
 */
export interface ObjectStorage {
  putSmallObject(input: PutSmallObjectInput): Promise<StoredObjectDescriptor>;
  getObject(input: { objectKey: string }): Promise<ObjectStorageGetResult>;
  getObjectStream(input: {
    objectKey: string;
    range?: ObjectStorageByteRange;
  }): Promise<ObjectStorageStreamResult>;
  headObject(input: { objectKey: string }): Promise<ObjectStorageHeadResult>;
  deleteObject(input: { objectKey: string }): Promise<void>;

  createMultipartUpload(
    input: CreateMultipartUploadInput,
  ): Promise<CreateMultipartUploadResult>;
  presignUploadPart(input: PresignUploadPartInput): Promise<PresignUploadPartResult>;
  listUploadedParts(input: ListUploadedPartsInput): Promise<ListUploadedPartsResult>;
  completeMultipartUpload(
    input: CompleteMultipartUploadInput,
  ): Promise<CompleteMultipartUploadResult>;
  abortMultipartUpload(input: AbortMultipartUploadInput): Promise<void>;
}

/**
 * Legacy method names used by ZIP KnowledgePayload and existing Docling upload paths.
 * Backends implement both naming schemes during the transition.
 */
export interface PayloadStorageCompat {
  put(input: PutSmallObjectInput): Promise<StoredObjectDescriptor>;
  get(input: { objectKey: string }): Promise<ObjectStorageGetResult>;
  head(input: { objectKey: string }): Promise<ObjectStorageHeadResult>;
  delete(input: { objectKey: string }): Promise<void>;
}

export type ObjectStorageBackend = ObjectStorage & PayloadStorageCompat;

/** @deprecated Prefer StoredObjectDescriptor. */
export type PayloadObjectDescriptor = StoredObjectDescriptor;
/** @deprecated Prefer PutSmallObjectInput. */
export type PayloadStoragePutInput = PutSmallObjectInput;
/** @deprecated Prefer ObjectStorageGetResult. */
export type PayloadStorageGetResult = ObjectStorageGetResult;
/** @deprecated Prefer ObjectStorageHeadResult. */
export type PayloadStorageHeadResult = ObjectStorageHeadResult;

/**
 * @deprecated Prefer ObjectStorage. Assignable via backends that implement PayloadStorageCompat.
 */
export type PayloadStorage = PayloadStorageCompat;

/** @deprecated Prefer objectKey naming; DB still uses storagePath column. */
export type PayloadStorageSaveResult = StoredObjectDescriptor & { storagePath: string };
