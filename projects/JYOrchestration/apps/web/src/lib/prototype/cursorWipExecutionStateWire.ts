import {
  CURSOR_WIP_EXECUTION_VERSION,
  type CursorDeveloperReview,
  type CursorRefactorRequest,
  type CursorWipCommit,
  type CursorWipExecutionStatus,
  type CursorWipExecutionV1,
} from "@/lib/prototype/cursorWipExecution";

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : [];
}

function parseWipCommit(raw: unknown): CursorWipCommit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const branchName = String(o.branchName ?? "").trim();
  const commitMessage = String(o.commitMessage ?? "").trim();
  const taskId = String(o.taskId ?? "").trim();
  const workItemId = String(o.workItemId ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  if (!branchName || !commitMessage || !createdAt) return null;
  return {
    sha: o.sha === undefined ? undefined : String(o.sha).trim() || undefined,
    branchName,
    commitMessage,
    taskId: taskId || "unknown",
    workItemId: workItemId || "unknown",
    changedFiles: parseStringArray(o.changedFiles),
    diffSummary: parseStringArray(o.diffSummary),
    testResults: parseStringArray(o.testResults),
    unresolvedIssues: parseStringArray(o.unresolvedIssues),
    createdAt,
  };
}

function parseDeveloperReview(raw: unknown): CursorDeveloperReview | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const status = String(o.status ?? "pending").trim() as CursorDeveloperReview["status"];
  const reviewedAt = String(o.reviewedAt ?? "").trim();
  if (!reviewedAt) return undefined;
  return {
    status: ["pending", "approved", "refactor_requested", "rejected"].includes(status)
      ? status
      : "pending",
    reviewedAt,
    summary: String(o.summary ?? "").trim(),
    findings: parseStringArray(o.findings),
    requestedActions: parseStringArray(o.requestedActions),
  };
}

function parseRefactorRequest(raw: unknown): CursorRefactorRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const requestedAt = String(o.requestedAt ?? "").trim();
  if (!id || !requestedAt) return null;
  const status = String(o.status ?? "requested").trim() as CursorRefactorRequest["status"];
  return {
    id,
    requestedAt,
    requestedBy: "ai_developer",
    reason: String(o.reason ?? "").trim(),
    instructions: String(o.instructions ?? "").trim(),
    targetCommitSha: o.targetCommitSha === undefined ? undefined : String(o.targetCommitSha).trim() || undefined,
    status: status === "applied" || status === "cancelled" ? status : "requested",
  };
}

const STATUSES = new Set<CursorWipExecutionStatus>([
  "not_requested",
  "requested",
  "drafting",
  "wip_committed",
  "developer_reviewing",
  "refactor_requested",
  "refactoring",
  "wip_updated",
  "developer_approved",
  "scm_commit_pending",
  "failed",
]);

export function parseCursorWipExecutionV1(raw: unknown): CursorWipExecutionV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== CURSOR_WIP_EXECUTION_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const branchName = String(o.branchName ?? "").trim();
  const requestedAt = String(o.requestedAt ?? "").trim();
  if (!projectId || !branchName || !requestedAt) return null;
  const status = String(o.status ?? "not_requested").trim() as CursorWipExecutionStatus;
  const commitsRaw = Array.isArray(o.commits) ? o.commits : [];
  const commits = commitsRaw.map(parseWipCommit).filter((c): c is CursorWipCommit => Boolean(c));
  const refactorRaw = Array.isArray(o.refactorRequests) ? o.refactorRequests : [];
  const refactorRequests = refactorRaw.map(parseRefactorRequest).filter((r): r is CursorRefactorRequest => Boolean(r));
  return {
    version: CURSOR_WIP_EXECUTION_VERSION,
    projectId,
    status: STATUSES.has(status) ? status : "not_requested",
    branchName,
    requestedAt,
    requestedBy: "ai_developer",
    workItems: parseStringArray(o.workItems),
    commits,
    developerReview: parseDeveloperReview(o.developerReview),
    refactorRequests,
  };
}
