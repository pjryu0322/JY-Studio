/**
 * P7.3: PipelineRun.triggerType marker for a Provider generation REQUEST.
 *
 * The request itself is store-only (no Worker run), but a lightweight PipelineRun
 * marker (status PENDING) is created so the Admin queue can list DRAFT packs with a
 * pending request via a DB query (triggerType is indexed) — no schema change. The
 * marker is retired (PASS) once an Admin executes generation, or superseded
 * (SKIPPED) when the Provider re-submits.
 */
export const WORKER_ZIP_REQUEST_TRIGGER = "WORKER_ZIP_REQUEST";

/**
 * P7.3: request marker status encoding the 접수(accept) lifecycle (no schema change):
 * - PENDING  → 접수 대기 (REQUESTED)   — Provider may withdraw
 * - RUNNING  → 접수완료 (ACCEPTED)     — Admin received it; Provider may NOT withdraw
 * - PASS     → retired after a successful generation
 * - SKIPPED  → withdrawn / superseded by a re-submission
 */
export const WORKER_ZIP_REQUEST_ACCEPTED_STATUS = "RUNNING";
