import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  evaluateCursorExecutionAvailability,
  resolveEffectiveCursorApiUrlFromSetup,
} from "@/lib/prototype/cursorExecutionAvailability";
import { DEFAULT_CURSOR_API_BASE } from "@/lib/executionSetup/cursorApiValidation";
import {
  resolveProjectTargetRepositoryFromExecutionSetup,
  type ProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";

export type TaskCursorSetupReadinessStatus =
  | "ready"
  | "missing_setup"
  | "missing_git_repo"
  | "missing_github_token"
  | "missing_cursor_token"
  | "missing_workspace"
  | "validation_failed"
  | "not_validated"
  | "endpoint_warning";

export type TaskCursorSetupReadiness = Readonly<{
  readonly status: TaskCursorSetupReadinessStatus;
  readonly ready: boolean;
  readonly reason: string;
  readonly warnings: readonly string[];
  readonly blockingIssues: readonly string[];
  readonly targetRepository?: ProjectTargetRepository;
  readonly effectiveCursorApiUrl?: string;
  readonly usesDefaultCursorApiUrl: boolean;
}>;

function maskRepoUrl(url: string | null | undefined): string {
  const raw = String(url ?? "").trim();
  if (!raw) return "(미설정)";
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname !== "/" ? parsed.pathname : ""}`;
  } catch {
    return raw.length > 48 ? `${raw.slice(0, 48)}…` : raw;
  }
}

export function evaluateTaskCursorExecutionSetupReadiness(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): TaskCursorSetupReadiness {
  const setup = input?.setup ?? null;
  if (!setup) {
    return {
      status: "missing_setup",
      ready: false,
      reason: "프로젝트 환경설정을 불러오지 못했습니다. 환경설정에서 GitHub/Cursor API를 저장해 주세요.",
      warnings: [],
      blockingIssues: ["환경설정 없음"],
      usesDefaultCursorApiUrl: false,
    };
  }

  const availability = evaluateCursorExecutionAvailability({ setup });
  const effectiveApi = resolveEffectiveCursorApiUrlFromSetup(setup);
  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoUrl: setup.gitRepoUrl,
    gitRepoName: setup.gitRepoName,
    gitRepoProvider: setup.gitRepoProvider,
    baseBranch: setup.baseBranch,
  });
  const warnings: string[] = [];
  const blockingIssues: string[] = [];

  if (!availability.hasGitRepo || !targetRepository) {
    blockingIssues.push("GitHub 저장소 미설정");
  }
  if (!availability.hasGithubToken) {
    blockingIssues.push("GitHub Token 미설정");
  }
  if (!availability.hasCursorToken) {
    blockingIssues.push("Cursor API Key 미설정");
  }
  if (!availability.hasWorkspace && !availability.workspaceAutoFromGit) {
    blockingIssues.push("Workspace 미설정");
  }

  if (effectiveApi.usesDefault) {
    warnings.push(
      `Cursor API URL이 기본값(${DEFAULT_CURSOR_API_BASE})입니다. Task Cursor 실행은 Cloud Agents API(POST /v0/agents)를 사용합니다.`,
    );
  }

  const validationError = setup.lastValidationError?.trim();
  if (setup.status === "invalid" || validationError) {
    blockingIssues.push(validationError ? "마지막 검증 실패" : "환경설정 invalid");
  } else if (setup.status !== "validated") {
    warnings.push("환경설정이 아직 validated 상태가 아닙니다. 환경설정에서 실행 검증을 완료해 주세요.");
  }

  if (setup.repoConnectionOk === false) {
    blockingIssues.push("Git 저장소 연결 검증 실패");
  }
  if (setup.cursorApiConnectionOk === false || setup.executorConnectionOk === false) {
    blockingIssues.push("Cursor API 연결 검증 실패");
  }

  let status: TaskCursorSetupReadinessStatus = "ready";
  if (blockingIssues.length) {
    status =
      !availability.hasGithubToken
        ? "missing_github_token"
        : !availability.hasCursorToken
          ? "missing_cursor_token"
          : !availability.hasGitRepo
            ? "missing_git_repo"
            : !availability.hasWorkspace && !availability.workspaceAutoFromGit
              ? "missing_workspace"
              : setup.status === "invalid" || validationError
                ? "validation_failed"
                : "missing_setup";
  } else if (setup.status !== "validated") {
    status = "not_validated";
  }

  const ready =
    blockingIssues.length === 0 &&
    availability.hasGitRepo &&
    availability.hasGithubToken &&
    availability.hasCursorToken &&
    (availability.hasWorkspace || availability.workspaceAutoFromGit) &&
    setup.status === "validated" &&
    setup.repoConnectionOk !== false &&
    setup.cursorApiConnectionOk !== false &&
    setup.executorConnectionOk !== false;

  const reason = ready
    ? effectiveApi.usesDefault
      ? "Task Cursor 실행 준비됨 — Cloud Agents API로 소스 생성·push 후 GitHub verify를 진행합니다."
      : "Task Cursor 실행에 필요한 GitHub 저장소·Token·Cursor API Key가 준비되었습니다."
    : blockingIssues.length
      ? blockingIssues.join(" · ")
      : status === "not_validated"
        ? "환경설정 저장은 되어 있으나 실행 검증이 필요합니다."
        : availability.reason;

  return {
    status,
    ready,
    reason,
    warnings,
    blockingIssues,
    ...(targetRepository ? { targetRepository } : {}),
    ...(effectiveApi.url ? { effectiveCursorApiUrl: effectiveApi.url } : {}),
    usesDefaultCursorApiUrl: effectiveApi.usesDefault,
  };
}

export function resolveTaskCursorExecutionEnvGate(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): Readonly<{ readonly blocked: boolean; readonly message?: string }> {
  const readiness = evaluateTaskCursorExecutionSetupReadiness(input);
  if (readiness.ready) return { blocked: false };
  if (readiness.status === "not_validated") {
    return {
      blocked: true,
      message:
        "환경설정 실행 검증이 완료되지 않았습니다. [환경설정] → 환경 검증을 완료한 뒤 Task를 실행해 주세요.",
    };
  }
  return { blocked: true, message: readiness.reason };
}

export function buildImplementationBoardEnvDetailLines(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): readonly string[] {
  const setup = input?.setup ?? null;
  const readiness = evaluateTaskCursorExecutionSetupReadiness({ setup });
  const availability = evaluateCursorExecutionAvailability({ setup });
  const effectiveApi = resolveEffectiveCursorApiUrlFromSetup(setup);
  const repoLabel =
    readiness.targetRepository?.repoFullName?.trim() ||
    String(setup?.gitRepoName ?? "").trim() ||
    "(미설정)";
  const baseBranch = String(setup?.baseBranch ?? readiness.targetRepository?.defaultBranch ?? "main").trim() || "main";
  const workspaceLabel = availability.workspaceAutoFromGit
    ? "Git 저장소 기준 자동"
    : availability.hasWorkspace
      ? String(setup?.workspacePath ?? "").trim() || "설정됨"
      : "(미설정)";

  const lines = [
    "=== Task Cursor 실행 환경 ===",
    `- 실행 준비: ${readiness.ready ? "ready" : readiness.status}`,
    `- 안내: ${readiness.reason}`,
    "",
    "=== 프로젝트 환경설정 ===",
    `- GitHub 저장소: ${repoLabel}`,
    `- Git URL: ${maskRepoUrl(setup?.gitRepoUrl)}`,
    `- Base Branch: ${baseBranch}`,
    `- GitHub Token: ${availability.hasGithubToken ? "설정됨" : "미설정"}`,
    `- Cursor API Key: ${availability.hasCursorToken ? "설정됨" : "미설정"}`,
    `- Cursor API URL: ${
      effectiveApi.usesDefault
        ? `기본값 (${DEFAULT_CURSOR_API_BASE})`
        : effectiveApi.url ?? "(미설정)"
    }`,
    `- Workspace: ${workspaceLabel}`,
    `- Allowed Paths: ${
      Array.isArray(setup?.allowedPathGlobs) && setup.allowedPathGlobs.length
        ? setup.allowedPathGlobs.join(", ")
        : "(기본)"
    }`,
    "",
    "=== 검증 상태 ===",
    `- Setup Status: ${setup?.status ?? "unknown"}`,
    `- Git 연결: ${setup?.repoConnectionOk === true ? "ok" : setup?.repoConnectionOk === false ? "failed" : "unchecked"}`,
    `- Cursor API: ${setup?.cursorApiConnectionOk === true ? "ok" : setup?.cursorApiConnectionOk === false ? "failed" : "unchecked"}`,
    `- Executor: ${setup?.executorConnectionOk === true ? "ok" : setup?.executorConnectionOk === false ? "failed" : "unchecked"}`,
    ...(setup?.lastValidatedAt ? [`- Last Validated: ${setup.lastValidatedAt}`] : []),
    ...(setup?.lastValidationError?.trim()
      ? [`- Last Validation Error: ${setup.lastValidationError.trim()}`]
      : []),
    "",
    "=== Task Cursor 정책 ===",
    "- Cursor: Cloud Agents API 또는 bridge /execute로 소스 생성 + push",
    "- Platform: GitHub 결과 verify → 검수/보안/SCM 통제",
    "- WIP stub: 실행 단위로 사용하지 않음",
  ];

  if (readiness.blockingIssues.length) {
    lines.push("", "=== 차단 사유 ===", ...readiness.blockingIssues.map((issue) => `- ${issue}`));
  }
  if (readiness.warnings.length) {
    lines.push("", "=== 주의 ===", ...readiness.warnings.map((warning) => `- ${warning}`));
  }

  return lines;
}

export function formatTaskCursorSetupReadinessPillValue(
  readiness: TaskCursorSetupReadiness,
): string {
  if (readiness.ready) return "준비됨";
  switch (readiness.status) {
    case "missing_github_token":
      return "GitHub Token 필요";
    case "missing_cursor_token":
      return "Cursor Key 필요";
    case "missing_git_repo":
      return "Git 저장소 필요";
    case "missing_workspace":
      return "Workspace 필요";
    case "validation_failed":
      return "검증 실패";
    case "not_validated":
      return "검증 필요";
    case "endpoint_warning":
      return "API URL 확인";
    case "missing_setup":
      return "미설정";
    default:
      return readiness.status;
  }
}
