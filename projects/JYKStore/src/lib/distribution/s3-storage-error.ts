/** Compatibility shim — prefer `@/lib/object-storage/s3-storage-error`. */
export {
  classifyS3StorageError,
  describeS3StorageProbeError,
  isS3ObjectNotFoundError,
  mapS3StorageError,
  type S3StorageErrorClass,
  type S3StorageOperation,
} from "@/lib/object-storage/s3-storage-error";
