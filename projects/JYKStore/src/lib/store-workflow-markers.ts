/**
 * Persist Store workflow handoffs via PipelineRun markers (no schema migration).
 *
 * P12.3: implementation moved to src/lib/workflow/markers/* (split by concern);
 * this file stays as a thin facade so existing `@/lib/store-workflow-markers`
 * imports keep working unchanged.
 *
 * STORE_PROVIDER_REVIEW:
 *   PENDING  → admin requested provider confirm (PROVIDER_REVIEW_REQUESTED)
 *   PASS     → provider confirmed (PROVIDER_REVIEW_CONFIRMED)
 *   SKIPPED  → withdrawn / superseded
 *
 * STORE_SERVICE_VALIDATION:
 *   PASS     → admin marked service validation complete
 *   SKIPPED  → superseded after provider withdraw
 */

export * from "@/lib/workflow/markers";
