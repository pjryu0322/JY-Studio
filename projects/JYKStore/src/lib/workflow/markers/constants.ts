/**
 * Trigger-type string constants for Store workflow PipelineRun markers.
 * See ../../store-workflow-markers.ts (facade) for the overall design note.
 */

/** Same trigger string as worker-zip-import-provider-service (avoid circular import). */
export const WORKER_ZIP_REQUEST_TRIGGER = "WORKER_ZIP_REQUEST";
export const WORKER_ZIP_IMPORT_TRIGGER = "WORKER_ZIP_IMPORT";

export const STORE_PROVIDER_REVIEW_TRIGGER = "STORE_PROVIDER_REVIEW";
export const STORE_SERVICE_VALIDATION_TRIGGER = "STORE_SERVICE_VALIDATION";
