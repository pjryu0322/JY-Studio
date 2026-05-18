import { parsePrStatusForTeamRuntime } from "./prStatusParse";
import { parseTeamReviewPhasesFromReviewerSteps } from "./reviewerSteps";
import { coerceReviewerStepsForTimeline } from "./timelineReviewerSteps";
import { AI_TEAM_EXECUTION_STATUS, type AiTeamExecutionStatus, isAiTeamExecutionStatus } from "./status";

export type AiTeamRuntimeTimelineStage =
  | "developer"
  | "git"
  | "review"
  | "security"
  | "approval"
  | "scm"
  | "completion";

export type AiTeamRuntimeTimelineStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "skipped";

export type AiTeamRuntimeTimelineItem = Readonly<{
  id: string;
  stage: AiTeamRuntimeTimelineStage;
  titleKo: string;
  status: AiTeamRuntimeTimelineStatus;
  summaryKo?: string | null;
  detailKo?: string | null;
  actorKo?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  prUrl?: string | null;
  prNumber?: number | null;
  branchName?: string | null;
  commitSha?: string | null;
  changedFileCount?: number | null;
  blockReason?: string | null;
  raw?: unknown;
}>;

export const AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO: Readonly<
  Record<AiTeamRuntimeTimelineStatus, string>
> = {
  pending: "대기",
  running: "진행중",
  succeeded: "완료",
  failed: "실패",
  blocked: "차단",
  skipped: "건너뜀",
};

const STAGE_ORDER: readonly AiTeamRuntimeTimelineStage[] = [
  "developer",
  "git",
  "review",
  "security",
  "approval",
  "scm",
  "completion",
] as const;

const STAGE_TITLE_KO: Readonly<Record<AiTeamRuntimeTimelineStage, string>> = {
  developer: "AI개발자 실행",
  git: "Git 변경 감지",
  review: "AI검수자 검토",
  security: "AI보안관 점검",
  approval: "사용자 승인",
  scm: "SCM 처리",
  completion: "완료/차단",
};

export type BuildAiTeamRuntimeTimelineInput = Readonly<{
  run: Readonly<{
    id: string;
    status?: string | null;
    teamExecutionStatus?: string | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
    branchName?: string | null;
    commitSha?: string | null;
    changedFiles?: unknown;
    gitSummary?: string | null;
    prStatus?: string | null;
    evaluationDecision?: string | null;
    evaluationReason?: string | null;
    evaluationReviewerSteps?: unknown;
    runError?: string | null;
    cursorRunId?: string | null;
    cursorSummary?: string | null;
  }>;
  task?: Readonly<{
    executionWorkflowStatus?: string | null;
    lastEvalResult?: string | null;
    lastEvalSummary?: string | null;
  }> | null;
  requireApproval?: boolean;
}>;

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value).trim();
  return s || null;
}

function shortSha(sha: string | null | undefined): string | null {
  const s = String(sha ?? "").trim();
  if (!s) return null;
  return s.length > 8 ? s.slice(0, 8) : s;
}

function changedFileCount(changedFiles: unknown): number {
  return Array.isArray(changedFiles) ? changedFiles.length : 0;
}

function resolveTeamStatus(run: BuildAiTeamRuntimeTimelineInput["run"]): AiTeamExecutionStatus | null {
  const stored = run.teamExecutionStatus?.trim();
  if (stored && isAiTeamExecutionStatus(stored)) return stored;
  return null;
}

function evaluationReasonLower(run: BuildAiTeamRuntimeTimelineInput["run"]): string {
  return String(run.evaluationReason ?? "").toLowerCase();
}

function scmHoldInReason(reason: string): boolean {
  return (
    reason.includes("scm") ||
    reason.includes("merge") ||
    reason.includes("auto-merge") ||
    reason.includes("auto merge") ||
    reason.includes("pull request") ||
    reason.includes("github_compare_failed")
  );
}

function buildDeveloperItem(
  run: BuildAiTeamRuntimeTimelineInput["run"],
  teamStatus: AiTeamExecutionStatus | null,
  startedAt: string | null,
  updatedAt: string | null
): AiTeamRuntimeTimelineItem {
  const files = changedFileCount(run.changedFiles);
  const hasEvidence = Boolean(
    run.cursorRunId?.trim() || run.branchName?.trim() || run.commitSha?.trim() || files > 0
  );

  let status: AiTeamRuntimeTimelineStatus = "pending";
  if (teamStatus === AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING) status = "running";
  else if (teamStatus === AI_TEAM_EXECUTION_STATUS.DEVELOPER_FAILED) status = "failed";
  else if (run.runError && !hasEvidence) status = "failed";
  else if (hasEvidence) status = "succeeded";

  const summaryKo =
    status === "succeeded"
      ? "Cursor가 작업을 수행하고 branch/commit 정보를 생성했습니다."
      : status === "running"
        ? "AI개발자(Cursor) 실행이 진행 중입니다."
        : status === "failed"
          ? run.runError ?? "AI개발자 실행에 실패했습니다."
          : "AI개발자 실행을 대기 중입니다.";

  return {
    id: "developer",
    stage: "developer",
    titleKo: STAGE_TITLE_KO.developer,
    status,
    summaryKo,
    actorKo: "AI개발자",
    startedAt,
    completedAt: status === "succeeded" || status === "failed" ? updatedAt : null,
    branchName: run.branchName ?? null,
    commitSha: run.commitSha ?? null,
    changedFileCount: files > 0 ? files : null,
    blockReason: status === "failed" ? run.runError ?? null : null,
  };
}

function buildGitItem(
  run: BuildAiTeamRuntimeTimelineInput["run"],
  pr: ReturnType<typeof parsePrStatusForTeamRuntime>,
  startedAt: string | null,
  updatedAt: string | null
): AiTeamRuntimeTimelineItem {
  const files = changedFileCount(run.changedFiles);
  const reason = evaluationReasonLower(run);
  const prOpenOrMerged =
    pr?.pullRequestState === "OPEN" ||
    pr?.pullRequestState === "MERGED" ||
    Boolean(run.prStatus?.trim());

  let status: AiTeamRuntimeTimelineStatus = "pending";
  if (reason.includes("github_compare_failed")) status = "blocked";
  else if (run.commitSha?.trim() || files > 0 || prOpenOrMerged) status = "succeeded";

  const parts: string[] = [];
  if (run.branchName) parts.push(`branch ${run.branchName}`);
  if (run.commitSha) parts.push(`commit ${shortSha(run.commitSha)}`);
  if (files > 0) parts.push(`변경 파일 ${files}개`);
  if (run.gitSummary?.trim()) parts.push(run.gitSummary.trim().slice(0, 120));

  return {
    id: "git",
    stage: "git",
    titleKo: STAGE_TITLE_KO.git,
    status,
    summaryKo: parts.length ? parts.join(" · ") : "Git 변경분을 수집합니다.",
    actorKo: "Git",
    startedAt,
    completedAt: status === "succeeded" || status === "blocked" ? updatedAt : null,
    prUrl: pr?.pullRequestUrl ?? null,
    prNumber: pr?.pullRequestNumber ?? null,
    branchName: run.branchName ?? null,
    commitSha: run.commitSha ?? null,
    changedFileCount: files > 0 ? files : null,
    blockReason: status === "blocked" ? run.evaluationReason ?? null : null,
  };
}

function mapPhaseStatus(
  phase: "pending" | "running" | "completed" | "failed" | "skipped"
): AiTeamRuntimeTimelineStatus {
  switch (phase) {
    case "completed":
      return "succeeded";
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return "pending";
  }
}

const PAST_REVIEW_STATUSES: readonly AiTeamExecutionStatus[] = [
  AI_TEAM_EXECUTION_STATUS.SECURITY_RUNNING,
  AI_TEAM_EXECUTION_STATUS.SECURITY_FAILED,
  AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
  AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
  AI_TEAM_EXECUTION_STATUS.DEPLOY_RUNNING,
  AI_TEAM_EXECUTION_STATUS.COMPLETED,
  AI_TEAM_EXECUTION_STATUS.FAILED,
];

const PAST_SECURITY_STATUSES: readonly AiTeamExecutionStatus[] = [
  AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
  AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
  AI_TEAM_EXECUTION_STATUS.DEPLOY_RUNNING,
  AI_TEAM_EXECUTION_STATUS.COMPLETED,
  AI_TEAM_EXECUTION_STATUS.FAILED,
];

function buildReviewItem(
  run: BuildAiTeamRuntimeTimelineInput["run"],
  teamStatus: AiTeamExecutionStatus | null,
  startedAt: string | null,
  updatedAt: string | null
): AiTeamRuntimeTimelineItem {
  const steps = coerceReviewerStepsForTimeline(run.evaluationReviewerSteps);
  const phases = parseTeamReviewPhasesFromReviewerSteps(steps);

  let status = mapPhaseStatus(phases.reviewer.status);
  if (teamStatus === AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING) status = "running";
  if (teamStatus === AI_TEAM_EXECUTION_STATUS.REVIEW_FAILED) status = "failed";
  if (
    teamStatus &&
    PAST_REVIEW_STATUSES.includes(teamStatus) &&
    (status === "pending" || status === "skipped")
  ) {
    status = "succeeded";
  }

  const issues = phases.reviewer.issues?.length ? phases.reviewer.issues.join("; ") : null;

  return {
    id: "review",
    stage: "review",
    titleKo: STAGE_TITLE_KO.review,
    status,
    summaryKo:
      status === "succeeded"
        ? "AI검수자 검토를 통과했습니다."
        : status === "failed"
          ? issues ?? "AI검수자 검토에 실패했습니다."
          : status === "skipped"
            ? "AI검수자 단계가 구성되지 않았습니다."
            : "AI검수자 검토를 진행합니다.",
    actorKo: "AI검수자",
    startedAt,
    completedAt: status === "succeeded" || status === "failed" ? updatedAt : null,
    detailKo: issues,
    blockReason: status === "failed" ? issues ?? run.evaluationReason ?? null : null,
  };
}

function buildSecurityItem(
  run: BuildAiTeamRuntimeTimelineInput["run"],
  teamStatus: AiTeamExecutionStatus | null,
  startedAt: string | null,
  updatedAt: string | null
): AiTeamRuntimeTimelineItem {
  const steps = coerceReviewerStepsForTimeline(run.evaluationReviewerSteps);
  const phases = parseTeamReviewPhasesFromReviewerSteps(steps);

  let status = mapPhaseStatus(phases.security.status);
  if (teamStatus === AI_TEAM_EXECUTION_STATUS.SECURITY_RUNNING) status = "running";
  if (teamStatus === AI_TEAM_EXECUTION_STATUS.SECURITY_FAILED) status = "failed";
  if (
    teamStatus &&
    PAST_SECURITY_STATUSES.includes(teamStatus) &&
    (status === "pending" || status === "skipped")
  ) {
    status = "succeeded";
  }

  const issues = phases.security.issues?.length ? phases.security.issues.join("; ") : null;

  return {
    id: "security",
    stage: "security",
    titleKo: STAGE_TITLE_KO.security,
    status,
    summaryKo:
      status === "succeeded"
        ? "AI보안관 점검을 통과했습니다."
        : status === "failed"
          ? issues ?? "AI보안관 점검에 실패했습니다."
          : status === "skipped"
            ? "AI보안관 단계가 구성되지 않았습니다."
            : "AI보안관 점검을 진행합니다.",
    actorKo: "AI보안관",
    startedAt,
    completedAt: status === "succeeded" || status === "failed" ? updatedAt : null,
    detailKo: issues,
    blockReason: status === "failed" ? issues ?? run.evaluationReason ?? null : null,
  };
}

function buildApprovalItem(
  run: BuildAiTeamRuntimeTimelineInput["run"],
  task: BuildAiTeamRuntimeTimelineInput["task"],
  teamStatus: AiTeamExecutionStatus | null,
  requireApproval: boolean,
  startedAt: string | null,
  updatedAt: string | null
): AiTeamRuntimeTimelineItem {
  const wf = String(task?.executionWorkflowStatus ?? "").trim().toLowerCase();

  let status: AiTeamRuntimeTimelineStatus = "pending";
  if (!requireApproval) {
    status = "skipped";
  } else if (teamStatus === AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING || wf === "awaiting_human") {
    status = "blocked";
  } else if (
    teamStatus === AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING ||
    teamStatus === AI_TEAM_EXECUTION_STATUS.COMPLETED ||
    wf === "merge_pending" ||
    wf === "merged"
  ) {
    status = "succeeded";
  }

  const blockReason =
    status === "blocked"
      ? run.evaluationReason ?? task?.lastEvalSummary ?? "사용자 승인이 필요합니다."
      : null;

  return {
    id: "approval",
    stage: "approval",
    titleKo: STAGE_TITLE_KO.approval,
    status,
    summaryKo:
      status === "blocked"
        ? "사용자 승인 대기 중입니다. 승인 후 merge 단계로 재개할 수 있습니다."
        : status === "succeeded"
          ? "사용자 승인 완료 — merge 단계 재개 가능"
          : status === "skipped"
            ? "승인 정책이 꺼져 있어 이 단계를 건너뜁니다."
            : "승인 정책이 켜져 있으면 이 단계에서 대기할 수 있습니다.",
    actorKo: "사용자",
    startedAt,
    completedAt: status === "succeeded" ? updatedAt : null,
    blockReason,
  };
}

function buildScmItem(
  run: BuildAiTeamRuntimeTimelineInput["run"],
  task: BuildAiTeamRuntimeTimelineInput["task"],
  teamStatus: AiTeamExecutionStatus | null,
  pr: ReturnType<typeof parsePrStatusForTeamRuntime>,
  startedAt: string | null,
  updatedAt: string | null
): AiTeamRuntimeTimelineItem {
  const reason = evaluationReasonLower(run);
  const wf = String(task?.executionWorkflowStatus ?? "").trim().toLowerCase();
  const prMerged = pr?.pullRequestState === "MERGED" || run.prStatus?.trim() === "merged";

  let status: AiTeamRuntimeTimelineStatus = "pending";
  if (scmHoldInReason(reason) || (wf === "merge_pending" && !prMerged)) status = "blocked";
  else if (teamStatus === AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING) status = "running";
  else if (prMerged || teamStatus === AI_TEAM_EXECUTION_STATUS.COMPLETED || wf === "merged") status = "succeeded";

  return {
    id: "scm",
    stage: "scm",
    titleKo: STAGE_TITLE_KO.scm,
    status,
    summaryKo:
      status === "succeeded"
        ? "SCM(PR/merge) 처리가 완료되었습니다."
        : status === "running"
          ? "SCM(PR 생성·merge) 단계를 진행 중입니다."
          : status === "blocked"
            ? "SCM/merge가 보류되었습니다."
            : "SCM 단계를 대기 중입니다.",
    actorKo: "SCM Manager",
    startedAt,
    completedAt: status === "succeeded" || status === "blocked" ? updatedAt : null,
    prUrl: pr?.pullRequestUrl ?? null,
    prNumber: pr?.pullRequestNumber ?? null,
    blockReason: status === "blocked" ? run.evaluationReason ?? null : null,
  };
}

function buildCompletionItem(
  run: BuildAiTeamRuntimeTimelineInput["run"],
  task: BuildAiTeamRuntimeTimelineInput["task"],
  teamStatus: AiTeamExecutionStatus | null,
  startedAt: string | null,
  updatedAt: string | null
): AiTeamRuntimeTimelineItem {
  const legacyStatus = String(run.status ?? "").trim().toLowerCase();
  const wf = String(task?.executionWorkflowStatus ?? "").trim().toLowerCase();

  let status: AiTeamRuntimeTimelineStatus = "pending";
  if (teamStatus === AI_TEAM_EXECUTION_STATUS.COMPLETED || legacyStatus === "done") {
    status = "succeeded";
  } else if (
    teamStatus === AI_TEAM_EXECUTION_STATUS.FAILED ||
    legacyStatus === "failed" ||
    Boolean(run.runError?.trim())
  ) {
    status = "failed";
  } else if (
    teamStatus === AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING ||
    wf === "merge_pending" ||
    wf === "awaiting_human" ||
    scmHoldInReason(evaluationReasonLower(run))
  ) {
    status = "blocked";
  }

  const blockReason =
    status === "blocked" || status === "failed"
      ? run.runError ?? run.evaluationReason ?? task?.lastEvalSummary ?? null
      : null;

  return {
    id: "completion",
    stage: "completion",
    titleKo: STAGE_TITLE_KO.completion,
    status,
    summaryKo:
      status === "succeeded"
        ? "실행이 완료되었습니다."
        : status === "failed"
          ? "실행이 실패로 종료되었습니다."
          : status === "blocked"
            ? "실행이 차단·보류 상태입니다."
            : "최종 완료 상태를 확인 중입니다.",
    startedAt,
    completedAt: updatedAt,
    blockReason,
  };
}

export function buildAiTeamRuntimeTimeline(
  input: BuildAiTeamRuntimeTimelineInput
): AiTeamRuntimeTimelineItem[] {
  const run = input.run;
  const startedAt = toIso(run.createdAt);
  const updatedAt = toIso(run.updatedAt);
  const teamStatus = resolveTeamStatus(run);
  const pr = parsePrStatusForTeamRuntime(run.prStatus);
  const requireApproval = input.requireApproval === true;

  const byStage: Record<AiTeamRuntimeTimelineStage, AiTeamRuntimeTimelineItem> = {
    developer: buildDeveloperItem(run, teamStatus, startedAt, updatedAt),
    git: buildGitItem(run, pr, startedAt, updatedAt),
    review: buildReviewItem(run, teamStatus, startedAt, updatedAt),
    security: buildSecurityItem(run, teamStatus, startedAt, updatedAt),
    approval: buildApprovalItem(run, input.task ?? null, teamStatus, requireApproval, startedAt, updatedAt),
    scm: buildScmItem(run, input.task ?? null, teamStatus, pr, startedAt, updatedAt),
    completion: buildCompletionItem(run, input.task ?? null, teamStatus, startedAt, updatedAt),
  };

  return STAGE_ORDER.map((stage) => byStage[stage]);
}

/** API-safe wrapper: never throws. */
export function buildAiTeamRuntimeTimelineSafe(
  input: BuildAiTeamRuntimeTimelineInput
): AiTeamRuntimeTimelineItem[] {
  try {
    return buildAiTeamRuntimeTimeline(input);
  } catch {
    return STAGE_ORDER.map((stage) => ({
      id: stage,
      stage,
      titleKo: STAGE_TITLE_KO[stage],
      status: "pending" as const,
      summaryKo: "타임라인을 구성하지 못했습니다.",
    }));
  }
}
