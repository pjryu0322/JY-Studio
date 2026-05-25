import {
  CODE_AGENT_WIP_EXECUTION_VERSION,
  normalizeLegacyCursorWipExecutionV1,
  type CodeAgentDeveloperReview,
  type CodeAgentRefactorRequest,
  type CodeAgentWipCommit,
  type CodeAgentWipExecutionStatus,
  type CodeAgentWipExecutionV1,
  type LegacyCursorWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import {
  DEFAULT_CODE_AGENT_PROVIDER,
  inferCodeAgentProviderFromBranch,
  parseCodeAgentProvider,
} from "@/lib/prototype/codeAgentProvider";

const CURSOR_WIP_EXECUTION_VERSION = "cursor_wip_execution_v1" as const;

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : [];
}

function parseWipCommit(raw: unknown, defaultProvider: CodeAgentWipCommit["provider"]): CodeAgentWipCommit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const branchName = String(o.branchName ?? "").trim();
  const commitMessage = String(o.commitMessage ?? "").trim();
  const taskId = String(o.taskId ?? "").trim();
  const workItemId = String(o.workItemId ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  if (!branchName || !commitMessage || !createdAt) return null;
  const provider = o.provider === undefined
    ? inferCodeAgentProviderFromBranch(branchName)
    : parseCodeAgentProvider(o.provider);
  return {
    sha: o.sha === undefined ? undefined : String(o.sha).trim() || undefined,
    provider: provider || defaultProvider,
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

function parseDeveloperReview(raw: unknown): CodeAgentDeveloperReview | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const status = String(o.status ?? "pending").trim() as CodeAgentDeveloperReview["status"];
  const reviewedAt = String(o.reviewedAt ?? "").trim();
  if (!reviewedAt) return undefined;
  return {
    status: ["pending", "approved", "refactor_requested", "rejected"].includes(status)
      ? status
      : "pending",
    reviewedAt,
    reviewedBy: "ai_developer",
    summary: String(o.summary ?? "").trim(),
    findings: parseStringArray(o.findings),
    requestedActions: parseStringArray(o.requestedActions),
  };
}

function parseRefactorRequest(
  raw: unknown,
  defaultProvider: CodeAgentRefactorRequest["provider"],
): CodeAgentRefactorRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const requestedAt = String(o.requestedAt ?? "").trim();
  if (!id || !requestedAt) return null;
  const status = String(o.status ?? "requested").trim() as CodeAgentRefactorRequest["status"];
  return {
    id,
    requestedAt,
    requestedBy: "ai_developer",
    provider: o.provider === undefined ? defaultProvider : parseCodeAgentProvider(o.provider),
    reason: String(o.reason ?? "").trim(),
    instructions: String(o.instructions ?? "").trim(),
    targetCommitSha: o.targetCommitSha === undefined ? undefined : String(o.targetCommitSha).trim() || undefined,
    status: status === "applied" || status === "cancelled" ? status : "requested",
  };
}

const STATUSES = new Set<CodeAgentWipExecutionStatus>([
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

export function parseCodeAgentWipExecutionV1(raw: unknown): CodeAgentWipExecutionV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const version = String(o.version ?? "").trim();
  if (version === CURSOR_WIP_EXECUTION_VERSION) {
    return normalizeLegacyCursorWipExecutionV1(o as unknown as LegacyCursorWipExecutionV1);
  }
  if (version !== CODE_AGENT_WIP_EXECUTION_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const branchName = String(o.branchName ?? "").trim();
  const requestedAt = String(o.requestedAt ?? "").trim();
  if (!projectId || !branchName || !requestedAt) return null;
  const provider = o.provider === undefined
    ? inferCodeAgentProviderFromBranch(branchName)
    : parseCodeAgentProvider(o.provider);
  const status = String(o.status ?? "not_requested").trim() as CodeAgentWipExecutionStatus;
  const commitsRaw = Array.isArray(o.commits) ? o.commits : [];
  const commits = commitsRaw
    .map((c) => parseWipCommit(c, provider))
    .filter((c): c is CodeAgentWipCommit => Boolean(c));
  const refactorRaw = Array.isArray(o.refactorRequests) ? o.refactorRequests : [];
  const refactorRequests = refactorRaw
    .map((r) => parseRefactorRequest(r, provider))
    .filter((r): r is CodeAgentRefactorRequest => Boolean(r));
  return {
    version: CODE_AGENT_WIP_EXECUTION_VERSION,
    projectId,
    provider: provider || DEFAULT_CODE_AGENT_PROVIDER,
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

export function parseCodeAgentWipExecutionFromState(
  modernRaw: unknown,
  legacyCursorRaw: unknown,
): CodeAgentWipExecutionV1 | null | undefined {
  if (modernRaw !== undefined) {
    const modern = parseCodeAgentWipExecutionV1(modernRaw);
    if (modern !== undefined && modern !== null) return modern;
    if (modernRaw === null) return null;
  }
  if (legacyCursorRaw === undefined) return undefined;
  return parseCodeAgentWipExecutionV1(legacyCursorRaw);
}
