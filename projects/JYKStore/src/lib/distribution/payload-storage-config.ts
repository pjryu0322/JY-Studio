/** Compatibility shim — prefer `@/lib/object-storage/object-storage-config`. */
export {
  buildPackFileObjectKey,
  buildPayloadObjectKey,
  describeObjectStorageConfig,
  describePayloadStorageConfig,
  parseObjectStorageConfig,
  parsePayloadStorageConfig,
  requireObjectStorageConfig,
  requirePayloadStorageConfig,
  type ObjectS3StorageConfig,
  type ObjectStorageConfigResult,
  type PayloadS3StorageConfig,
  type PayloadStorageConfigResult,
} from "@/lib/object-storage/object-storage-config";
