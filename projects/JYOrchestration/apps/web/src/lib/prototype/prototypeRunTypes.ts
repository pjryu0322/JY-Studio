/**
 * Prototype automation pipeline — domain types (DB migration 없이 파일 저장소 등으로 보관).
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
  "PR_READY",
  "PR_OPENED",
  "MERGE_READY",
  "MERGED",
  "PREVIEW_READY",
  "FAILED",
  "BLOCKED",
] as const;

export type PrototypeRunStatus = (typeof PROTOTYPE_RUN_STATUSES)[number];

/** 세부 사유 코드(표시·로그용). ENV_TEST taskKind 와 무관. */
export type PrototypeRunStatusReason =
  | "MANUAL_CURSOR_EXECUTION_REQUIRED"
  | "CURSOR_API_NOT_CONNECTED"
  | "EXECUTION_SETUP_INVALID"
  | "CURSOR_LAUNCH_FAILED"
  | "CURSOR_POLL_FAILED"
  | "STUB_CURSOR_ENABLED"
  | "AI_REVIEW_NOT_IMPLEMENTED"
  | "GIT_PIPELINE_NOT_IMPLEMENTED"
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
  changedFiles: readonly string[];
  aiReviewDecision: "PENDING" | "PASS" | "REWORK" | "NOT_IMPLEMENTED" | null;
  aiReviewSummary: string | null;
  prUrl: string | null;
  prNumber: number | null;
  mergeCommitSha: string | null;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PrototypeRunFileEnvelope = Readonly<{
  runs: PrototypeRun[];
}>;
