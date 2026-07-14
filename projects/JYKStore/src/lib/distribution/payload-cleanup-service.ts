/** Compatibility shim — prefer `@/lib/object-storage/object-cleanup-service`. */
export {
  enqueueObjectCleanupJob,
  enqueuePayloadCleanupJob,
  processObjectCleanupJob,
  processPayloadCleanupJob,
  retryPendingObjectCleanupJobs,
  retryPendingPayloadCleanupJobs,
} from "@/lib/object-storage/object-cleanup-service";
