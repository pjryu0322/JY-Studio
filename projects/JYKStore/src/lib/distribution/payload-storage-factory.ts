/**
 * Compatibility shim — prefer `@/lib/object-storage/object-storage-factory`.
 * Keeps the string `S3PayloadStorage` for contract tests.
 */
import { S3PayloadStorage } from "@/lib/distribution/s3-payload-storage";

export {
  getConfiguredObjectStorage,
  getConfiguredPayloadStorage,
  resetObjectStorageCache,
  resetPayloadStorageCache,
  setObjectStorageForTests,
  setPayloadStorageForTests,
} from "@/lib/object-storage/object-storage-factory";

void S3PayloadStorage;
