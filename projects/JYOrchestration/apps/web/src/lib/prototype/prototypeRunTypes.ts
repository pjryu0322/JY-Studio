/**
 * Prototype automation pipeline — domain types (DB migration 없이 파일 저장소).
 */

export const PROTOTYPE_RUN_STATUSES = [
  "DRAFT",
  "PROMPT_READY",
  "CURSOR_REQUESTED",
  "CURSOR_RUNNING",
  "COMMIT_DETECTED",
  "PUSH_CONFIRMED",
  "AI_REVIEWING",
  "REWORK_REQUIRED",
  "PR_OPENED",
  "MERGED",
  "PREVIEW_READY",
  "FAILED",
  "BLOCKED",
] as const;

export type PrototypeRunStatus = (typeof PROTOTYPE_RUN_STATUSES)[number];

/** 세부 사유 코드(표시·로그용). ENV_TEST taskKind 와 무관. */
export type PrototypeRunStatusReason =
  | "MANUAL_CURSOR_EXECUTION_REQUIRED"
  | "MANUAL_REVIEW_REQUIRED"
  | "CURSOR_API_NOT_CONNECTED"
  | "CURSOR_NOT_CONNECTED"
  | "EXECUTION_SETUP_INVALID"
  | "CURSOR_LAUNCH_FAILED"
  | "CURSOR_POLL_FAILED"
  | "PR_CREATE_FAILED"
  | "PR_MERGE_FAILED"
  | "STUB_CURSOR_ENABLED"
  | "AI_REVIEW_NOT_IMPLEMENTED"
  | "GIT_PIPELINE_NOT_IMPLEMENTED"
  | "REVIEW_DATA_MISSING"
  | "REVIEW_ENGINE_NOT_READY"
  | null;

export type PrototypeRun = Readonly<{
  id: string;
  projectId: string;
  selectedTemplate: string;
  promptSnapshot: string;
  branchName: string;
  cursorRunId: string | null;
  status: PrototypeRunStatus;
  statusReason: PrototypeRunStatusReason;
  commitSha: string | null;
  /** Cursor/GitHub에서 수집한 변경 파일(검토·PR용). */
  changedFiles: readonly string[];
  aiReviewDecision: "PENDING" | "PASS" | "REWORK" | "NOT_IMPLEMENTED" | null;
  aiReviewSummary: string | null;
  prUrl: string | null;
  prNumber: number | null;
  mergeSha: string | null;
  /** repo owner/repo 기반 GitHub Pages 예상 URL */
  suggestedPreviewUrl: string | null;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PrototypeRunFileEnvelope = Readonly<{
  runs: PrototypeRun[];
}>;
