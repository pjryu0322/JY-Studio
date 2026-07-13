export type PayloadObjectDescriptor = {
  /** S3 object key (DB column storagePath stores this value). */
  objectKey: string;
  fileSize: number;
  checksumSha256: string;
  etag?: string | null;
  versionId?: string | null;
};

export type PayloadStoragePutInput = {
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

export type PayloadStorageGetResult = {
  bytes: Uint8Array;
  contentLength: number;
  etag?: string | null;
  checksumSha256Metadata?: string | null;
};

export type PayloadStorageHeadResult = {
  exists: boolean;
  contentLength?: number;
  etag?: string | null;
  checksumSha256Metadata?: string | null;
};

/**
 * Immutable payload blob store backed by S3-compatible object storage.
 * Implementations must store original ZIP bytes without re-serialization.
 */
export interface PayloadStorage {
  put(input: PayloadStoragePutInput): Promise<PayloadObjectDescriptor>;
  get(input: { objectKey: string }): Promise<PayloadStorageGetResult>;
  head(input: { objectKey: string }): Promise<PayloadStorageHeadResult>;
  delete(input: { objectKey: string }): Promise<void>;
}

/** @deprecated Prefer objectKey naming; DB still uses storagePath column. */
export type PayloadStorageSaveResult = PayloadObjectDescriptor & { storagePath: string };
