import {
  CODE_AGENT_WIP_EXECUTION_VERSION,
  normalizeLegacyCursorWipExecutionV1,
  type CodeAgentDeveloperReview,
  type CodeAgentRefactorRequest,
  type CodeAgentWipBridgeExecutionStatus,
  type CodeAgentWipCommit,
  type CodeAgentWipExecutionMode,
  type CodeAgentWipExecutionStatus,
  type CodeAgentWipExecutionV1,
  type LegacyCursorWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import {
  parsePlatformScmExecutionV1,
} from "@/lib/prototype/platformScmExecution";
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
    ...(typeof o.targetRepository === "string" && o.targetRepository.trim()
      ? { targetRepository: o.targetRepository.trim() }
      : {}),
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
  const selectedTaskId =
    typeof o.selectedTaskId === "string" && o.selectedTaskId.trim() ? o.selectedTaskId.trim() : undefined;
  const selectedWorkItemIds = parseStringArray(o.selectedWorkItemIds);
  const executionModeRaw = String(o.executionMode ?? "").trim() as CodeAgentWipExecutionMode;
  const executionMode: CodeAgentWipExecutionMode | undefined = [
    "stub",
    "cursor_bridge",
    "cursor_api",
    "external",
  ].includes(executionModeRaw)
    ? executionModeRaw
    : undefined;
  const bridgeAdapterRaw = String(o.bridgeAdapter ?? "").trim();
  const bridgeAdapter =
    bridgeAdapterRaw === "cursor_api"
      ? (bridgeAdapterRaw as import("@/lib/prototype/codeAgentWipExecution").CodeAgentBridgeAdapter)
      : undefined;
  const bridgeLifecycleStatuses = new Set([
    "draft_created",
    "draft_approved",
    "bridge_requested",
    "bridge_running",
    "bridge_completed",
    "failed",
    "cancelled",
  ]);
  const cursorApiOutcomeStatuses = new Set(["bridge_completed", "cursor_api_failed", "cursor_api_unsupported"]);
  const bridgeStatusRaw = String(o.bridgeExecutionStatus ?? "").trim();
  const executionStatusRaw = String(o.executionStatus ?? "").trim();
  const bridgeExecutionStatus: CodeAgentWipBridgeExecutionStatus | undefined = bridgeLifecycleStatuses.has(
    bridgeStatusRaw,
  )
    ? (bridgeStatusRaw as CodeAgentWipBridgeExecutionStatus)
    : bridgeLifecycleStatuses.has(executionStatusRaw)
      ? (executionStatusRaw as CodeAgentWipBridgeExecutionStatus)
      : undefined;
  const executionStatus =
    cursorApiOutcomeStatuses.has(executionStatusRaw) ||
    (executionStatusRaw === "bridge_completed" && bridgeExecutionStatus === "bridge_completed")
      ? (executionStatusRaw as import("@/lib/prototype/codeAgentWipExecution").CodeAgentCursorApiExecutionStatus)
      : undefined;
  const bridgeCompletedAt =
    typeof o.bridgeCompletedAt === "string" && o.bridgeCompletedAt.trim()
      ? o.bridgeCompletedAt.trim()
      : undefined;
  const bridgeErrorMessage =
    typeof o.bridgeErrorMessage === "string" && o.bridgeErrorMessage.trim()
      ? o.bridgeErrorMessage.trim()
      : undefined;
  const pushed = o.pushed === true ? true : o.pushed === false ? false : undefined;
  const prNumber =
    typeof o.prNumber === "number" && Number.isFinite(o.prNumber) ? o.prNumber : undefined;
  const targetRepository =
    typeof o.targetRepository === "string" && o.targetRepository.trim()
      ? o.targetRepository.trim()
      : undefined;
  const targetRepoFullName =
    typeof o.targetRepoFullName === "string" && o.targetRepoFullName.trim()
      ? o.targetRepoFullName.trim()
      : targetRepository;
  const workspacePath =
    typeof o.workspacePath === "string" && o.workspacePath.trim() ? o.workspacePath.trim() : undefined;
  const baseBranch =
    typeof o.baseBranch === "string" && o.baseBranch.trim() ? o.baseBranch.trim() : undefined;
  const snapshotRaw = o.targetRepositorySnapshot;
  const targetRepositorySnapshot =
    snapshotRaw && typeof snapshotRaw === "object"
      ? (() => {
          const s = snapshotRaw as Record<string, unknown>;
          const owner = String(s.owner ?? "").trim();
          const repo = String(s.repo ?? "").trim();
          const repoFullName = String(s.repoFullName ?? "").trim() || (owner && repo ? `${owner}/${repo}` : "");
          const gitRepoUrl = String(s.gitRepoUrl ?? "").trim();
          const defaultBranch = String(s.defaultBranch ?? "main").trim() || "main";
          if (!owner || !repo || !repoFullName || !gitRepoUrl) return undefined;
          return { owner, repo, repoFullName, gitRepoUrl, defaultBranch };
        })()
      : undefined;
  const commitSha =
    typeof o.commitSha === "string" && o.commitSha.trim() ? o.commitSha.trim() : undefined;
  const pushStatusRaw = String(o.pushStatus ?? "").trim();
  const pushStatus =
    pushStatusRaw === "success" || pushStatusRaw === "skipped" || pushStatusRaw === "failed"
      ? pushStatusRaw
      : undefined;
  const pushErrorMessage =
    typeof o.pushErrorMessage === "string" && o.pushErrorMessage.trim()
      ? o.pushErrorMessage.trim()
      : undefined;
  const prStatus =
    typeof o.prStatus === "string" && o.prStatus.trim() ? o.prStatus.trim() : undefined;
  const bridgeAllowedPathGlobs = parseStringArray(o.bridgeAllowedPathGlobs);
  const bridgeAutoPush = o.bridgeAutoPush === true ? true : o.bridgeAutoPush === false ? false : undefined;
  const bridgeAutoPr = o.bridgeAutoPr === true ? true : o.bridgeAutoPr === false ? false : undefined;
  const cursorExternalPushStatus =
    typeof o.cursorExternalPushStatus === "string" && o.cursorExternalPushStatus.trim()
      ? o.cursorExternalPushStatus.trim()
      : undefined;
  const cursorExternalPrNumber =
    typeof o.cursorExternalPrNumber === "number" && Number.isFinite(o.cursorExternalPrNumber)
      ? o.cursorExternalPrNumber
      : undefined;
  const cursorExternalPrStatus =
    typeof o.cursorExternalPrStatus === "string" && o.cursorExternalPrStatus.trim()
      ? o.cursorExternalPrStatus.trim()
      : undefined;
  const platformScmExecutionV1 = parsePlatformScmExecutionV1(o.platformScmExecutionV1);
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
    ...(selectedTaskId ? { selectedTaskId } : {}),
    ...(selectedWorkItemIds.length ? { selectedWorkItemIds } : {}),
    ...(executionMode ? { executionMode } : {}),
    ...(bridgeAdapter ? { bridgeAdapter } : {}),
    ...(bridgeExecutionStatus ? { bridgeExecutionStatus } : {}),
    ...(executionStatus ? { executionStatus } : {}),
    ...(bridgeCompletedAt ? { bridgeCompletedAt } : {}),
    ...(bridgeErrorMessage ? { bridgeErrorMessage } : {}),
    ...(pushed !== undefined ? { pushed } : {}),
    ...(prNumber !== undefined ? { prNumber } : {}),
    ...(targetRepository ? { targetRepository } : {}),
    ...(targetRepoFullName ? { targetRepoFullName } : {}),
    ...(workspacePath ? { workspacePath } : {}),
    ...(baseBranch ? { baseBranch } : {}),
    ...(targetRepositorySnapshot ? { targetRepositorySnapshot } : {}),
    ...(commitSha ? { commitSha } : {}),
    ...(pushStatus ? { pushStatus } : {}),
    ...(pushErrorMessage ? { pushErrorMessage } : {}),
    ...(prStatus ? { prStatus } : {}),
    ...(bridgeAllowedPathGlobs.length ? { bridgeAllowedPathGlobs } : {}),
    ...(bridgeAutoPush !== undefined ? { bridgeAutoPush } : {}),
    ...(bridgeAutoPr !== undefined ? { bridgeAutoPr } : {}),
    ...(cursorExternalPushStatus ? { cursorExternalPushStatus } : {}),
    ...(cursorExternalPrNumber !== undefined ? { cursorExternalPrNumber } : {}),
    ...(cursorExternalPrStatus ? { cursorExternalPrStatus } : {}),
    ...(platformScmExecutionV1 ? { platformScmExecutionV1 } : {}),
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
