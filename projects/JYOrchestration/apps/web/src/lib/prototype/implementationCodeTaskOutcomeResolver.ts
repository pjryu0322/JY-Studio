import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseCodeTaskGithubOutcomeV1 } from "@/lib/prototype/codeTaskGithubOutcome";
import {
  buildUserSafeCodeTaskFailureMessage,
  operatorDiagnosticMessageForGithubFailureReason,
} from "@/lib/prototype/implementationUserSafeFailureMessage";
import {
  isExecutionUnitInFlight,
  type ImplementationExecutionUnitV1,
} from "@/lib/prototype/implementationExecutionUnit";

export type AuthoritativeCodeTaskOutcomeStatusV1 =
  | "pending"
  | "running"
  | "verifying"
  | "verified"
  | "failed"
  | "skipped"
  | "inconsistent";

export type AuthoritativeCodeTaskOutcomeV1 = Readonly<{
  codeTaskId: string;
  processTaskId: string | null;
  unitId: string | null;
  status: AuthoritativeCodeTaskOutcomeStatusV1;
  latestRunId: string | null;
  latestOutcomeStatus: "verified" | "failed" | "no_code_change" | null;
  hasPersistedGithubOutcome: boolean;
  commitSha: string | null;
  failureReason: string | null;
  userSafeTitle: string;
  userSafeMessage: string;
  userSafeReasonLine: string;
  userSafeNextActionLine: string;
  userActionLabel: string | null;
  operatorLogRef: string | null;
}>;

export function findAuthoritativeLatestRunForCodeTask(
  runs: readonly CodeTaskExecutionRunV1[],
  codeTaskId: string,
): CodeTaskExecutionRunV1 | null {
  const id = codeTaskId.trim();
  const matches = (runs ?? []).filter((r) => r.codeTaskId.trim() === id);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => {
    const attemptA = Number.isFinite(a.attemptNo) ? a.attemptNo : 0;
    const attemptB = Number.isFinite(b.attemptNo) ? b.attemptNo : 0;
    if (attemptA !== attemptB) return attemptB - attemptA;
    const createdCmp = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    if (createdCmp !== 0) return createdCmp;
    const updatedCmp = (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    if (updatedCmp !== 0) return updatedCmp;
    return (b.runId ?? "").localeCompare(a.runId ?? "");
  })[0] ?? null;
}

function readPersistedGithubOutcomeStatus(
  run: CodeTaskExecutionRunV1 | null | undefined,
): "verified" | "failed" | "no_code_change" | null {
  if (!run) return null;
  const parsed = parseCodeTaskGithubOutcomeV1(run.githubOutcome);
  if (parsed?.status === "verified") return "verified";
  if (parsed?.status === "failed") return "failed";
  if (run.status === "no_code_change_completed") return "no_code_change";
  return null;
}

function resolveFailureReason(
  unit: ImplementationExecutionUnitV1,
  run: CodeTaskExecutionRunV1 | null,
): string | null {
  const gh = parseCodeTaskGithubOutcomeV1(run?.githubOutcome);
  if (gh?.status === "failed") return gh.reason;
  if (unit.errorCode?.trim()) return unit.errorCode.trim();
  if (run?.failureReason?.trim()) return run.failureReason.trim();
  return null;
}

export function resolveAuthoritativeCodeTaskOutcome(input: {
  readonly unit: ImplementationExecutionUnitV1;
  readonly runs: readonly CodeTaskExecutionRunV1[];
}): AuthoritativeCodeTaskOutcomeV1 {
  const unit = input.unit;
  const latestRun = findAuthoritativeLatestRunForCodeTask(input.runs, unit.codeTaskId);
  const latestOutcomeStatus = readPersistedGithubOutcomeStatus(latestRun);
  const hasPersistedGithubOutcome = latestOutcomeStatus !== null;
  const title = unit.title.trim() || unit.codeTaskId;
  const failureReason = resolveFailureReason(unit, latestRun);

  let status: AuthoritativeCodeTaskOutcomeStatusV1 = "pending";

  if (latestOutcomeStatus === "failed") {
    status = "failed";
  } else if (unit.status === "skipped" || latestRun?.status === "skipped_by_user") {
    status = "skipped";
  } else if (
    latestOutcomeStatus === "verified" ||
    latestOutcomeStatus === "no_code_change"
  ) {
    if (unit.status === "verified" || unit.status === "skipped") {
      status = "verified";
    } else {
      status = "inconsistent";
    }
  } else if (unit.status === "failed" && (unit.failedAt || unit.errorCode)) {
    status = "failed";
  } else if (unit.status === "verified") {
    status = "inconsistent";
  } else if (unit.status === "running" && !hasPersistedGithubOutcome) {
    status = "running";
  } else if (
    (unit.status === "verifying" || latestRun?.status === "github_verifying") &&
    !hasPersistedGithubOutcome
  ) {
    status = "verifying";
  } else if (isExecutionUnitInFlight(unit.status)) {
    status = "running";
  } else if (
    latestRun &&
    !hasPersistedGithubOutcome &&
    (latestRun.status === "cursor_running" || latestRun.status === "github_verifying")
  ) {
    status = latestRun.status === "github_verifying" ? "verifying" : "running";
  } else {
    status = "pending";
  }

  const userSafe =
    status === "failed"
      ? buildUserSafeCodeTaskFailureMessage({ reason: failureReason, codeTaskTitle: title })
      : null;

  return {
    codeTaskId: unit.codeTaskId,
    processTaskId: unit.processTaskId?.trim() || null,
    unitId: unit.unitId,
    status,
    latestRunId: latestRun?.runId ?? null,
    latestOutcomeStatus,
    hasPersistedGithubOutcome,
    commitSha:
      latestRun?.commitSha?.trim() ||
      latestRun?.branchHeadCommitSha?.trim() ||
      null,
    failureReason,
    userSafeTitle: userSafe?.title ?? "",
    userSafeMessage: userSafe?.message ?? "",
    userSafeReasonLine: userSafe?.reasonLine ?? "",
    userSafeNextActionLine: userSafe?.nextActionLine ?? "",
    userActionLabel: userSafe?.actionLabel ?? null,
    operatorLogRef:
      status === "failed"
        ? operatorDiagnosticMessageForGithubFailureReason(failureReason)
        : null,
  };
}

export function mapAuthoritativeOutcomeToVerificationDisplayStatus(
  status: AuthoritativeCodeTaskOutcomeStatusV1,
): import("@/lib/prototype/implementationExecutionUnitVerification").ExecutionUnitVerificationDisplayStatusV1 {
  switch (status) {
    case "verified":
      return "verified";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "inconsistent":
      return "verification_inconsistent";
    case "running":
    case "verifying":
      return "in_progress";
    default:
      return "pending";
  }
}
