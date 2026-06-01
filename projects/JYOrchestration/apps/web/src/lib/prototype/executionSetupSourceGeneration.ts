import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  formatGitRepoWorkspaceSourceLabel,
  resolveSourceGenerationWorkspaceRoot,
  type GitRepoWorkspaceRootSource,
} from "@/lib/prototype/gitRepoAutoWorkspace";
import {
  evaluateCursorExecutionAvailability,
  resolveEffectiveCursorApiUrlFromSetup,
} from "@/lib/prototype/cursorExecutionAvailability";
import {
  resolveProjectTargetRepositoryFromExecutionSetup,
  type ProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";
import { defaultForbiddenTargetPathGlobs } from "@/lib/prototype/targetRepositoryPathGuard";

export type ExecutionSetupSourceGenerationRow = Readonly<{
  readonly gitRepoUrl?: string | null;
  readonly gitRepoName?: string | null;
  readonly gitRepoProvider?: string | null;
  readonly baseBranch?: string | null;
  readonly workspacePath?: string | null;
  readonly allowedPathGlobs?: unknown;
  readonly autoCommit?: boolean | null;
  readonly autoPush?: boolean | null;
  readonly autoPr?: boolean | null;
  readonly cursorApiUrl?: string | null;
  readonly cursorApiToken?: string | null;
  readonly hasCursorToken?: boolean | null;
  readonly githubAccessToken?: string | null;
  readonly hasGithubAccessToken?: boolean | null;
  readonly status?: "draft" | "validated" | "invalid" | null;
  readonly lastValidatedAt?: string | null;
  readonly lastValidationError?: string | null;
  readonly repoConnectionOk?: boolean | null;
  readonly cursorApiConnectionOk?: boolean | null;
  readonly executorConnectionOk?: boolean | null;
  readonly enableLlmCodeTaskRefinement?: boolean | null;
}>;

export function mapExecutionSetupDtoToSourceGenerationRow(
  data: ExecutionSetupDto | null | undefined,
): ExecutionSetupSourceGenerationRow | null {
  if (!data) return null;
  return {
    gitRepoUrl: data.gitRepoUrl,
    gitRepoName: data.gitRepoName,
    gitRepoProvider: data.gitRepoProvider,
    baseBranch: data.baseBranch,
    workspacePath: data.workspacePath,
    allowedPathGlobs: data.allowedPathGlobs,
    autoCommit: data.autoCommit,
    autoPush: data.autoPush,
    autoPr: data.autoPr,
    cursorApiUrl: data.cursorApiUrl,
    hasCursorToken: data.hasCursorToken,
    hasGithubAccessToken: data.hasGithubAccessToken,
    status: data.status,
    lastValidatedAt: data.lastValidatedAt,
    lastValidationError: data.lastValidationError,
    repoConnectionOk: data.repoConnectionOk,
    cursorApiConnectionOk: data.cursorApiConnectionOk,
    executorConnectionOk: data.executorConnectionOk,
    enableLlmCodeTaskRefinement: data.enableLlmCodeTaskRefinement ?? null,
  };
}

export function mapExecutionSetupPrismaRowToSourceGenerationRow(
  row: ExecutionSetupSourceGenerationRow | null | undefined,
): ExecutionSetupSourceGenerationRow | null {
  if (!row) return null;
  return {
    ...row,
    hasCursorToken:
      row.hasCursorToken === true || Boolean(String(row.cursorApiToken ?? "").trim()),
    hasGithubAccessToken:
      row.hasGithubAccessToken === true || Boolean(String(row.githubAccessToken ?? "").trim()),
  };
}

export type ExecutionSetupSourceGenerationContext = Readonly<{
  readonly targetRepository: ProjectTargetRepository;
  readonly workspaceRoot: string;
  readonly workspaceRootSource: GitRepoWorkspaceRootSource;
  readonly workspaceRootFallbackWarning?: string;
  readonly baseBranch: string;
  readonly allowedPathGlobs: readonly string[];
  readonly forbiddenPathGlobs: readonly string[];
  readonly autoCommit: boolean;
  readonly autoPush: boolean;
  readonly autoPr: boolean;
  readonly cursorApiUrl?: string;
  readonly hasCursorToken: boolean;
  readonly hasGithubToken: boolean;
  readonly bridgeAvailable: boolean;
}>;

export function isCursorSourceGenerationConfigured(input: {
  readonly cursorApiUrl?: string | null;
  readonly cursorApiToken?: string | null;
  readonly env?: Record<string, string | undefined>;
}): boolean {
  return evaluateCursorExecutionAvailability({
    setup: {
      cursorApiUrl: input.cursorApiUrl,
      cursorApiToken: input.cursorApiToken,
    },
  }).ready;
}

export function resolveSourceGenerationWorkspaceRootFromSetup(input: {
  readonly workspacePath?: string | null;
  readonly targetRepository?: ProjectTargetRepository | null;
  readonly env?: Record<string, string | undefined>;
}) {
  return resolveSourceGenerationWorkspaceRoot(input);
}

export { resolveSourceGenerationWorkspaceRoot } from "@/lib/prototype/gitRepoAutoWorkspace";

export function evaluateExecutionSetupSourceGenerationReadiness(input: {
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
  readonly env?: Record<string, string | undefined>;
}): Readonly<
  | { readonly ok: true; readonly context: ExecutionSetupSourceGenerationContext }
  | { readonly ok: false; readonly message: string; readonly missing: readonly string[] }
> {
  const missing: string[] = [];

  if (!input.setup) {
    missing.push("실행환경 설정 없음");
    return {
      ok: false,
      message: [
        "실행환경 설정이 없습니다.",
        "환경설정에서 Git 저장소와 Cursor 설정을 먼저 저장해 주세요.",
        "",
        "부족 항목:",
        ...missing.map((m) => `- ${m}`),
      ].join("\n"),
      missing,
    };
  }

  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoUrl: input.setup.gitRepoUrl,
    gitRepoName: input.setup.gitRepoName,
    gitRepoProvider: input.setup.gitRepoProvider,
    baseBranch: input.setup.baseBranch,
  });
  if (!targetRepository) {
    missing.push("Git 저장소 설정 없음");
  }

  const workspace = resolveSourceGenerationWorkspaceRoot({
    workspacePath: input.setup.workspacePath,
    targetRepository,
    env: input.env,
  });

  const cursorAvailability = evaluateCursorExecutionAvailability({
    setup: input.setup,
    env: input.env,
  });
  const cursorApiReady = cursorAvailability.ready;
  const hasCursorToken =
    input.setup.hasCursorToken === true || Boolean(String(input.setup.cursorApiToken ?? "").trim());
  if (!cursorApiReady) {
    missing.push(cursorAvailability.reason);
  }

  if (!targetRepository) {
    // already pushed above
  } else if (!workspace) {
    missing.push("Git 저장소 기준 작업공간을 준비할 수 없습니다.");
  }

  if (missing.length) {
    return {
      ok: false,
      message: [
        "Cursor 실행 요청이 차단되었습니다.",
        "",
        "부족 항목:",
        ...missing.map((m) => `- ${m}`),
      ].join("\n"),
      missing,
    };
  }

  const allowedPathGlobs = parseStringArrayJson(input.setup!.allowedPathGlobs);
  const forbiddenPathGlobs = defaultForbiddenTargetPathGlobs();
  const effectiveApi = resolveEffectiveCursorApiUrlFromSetup(input.setup);

  return {
    ok: true,
    context: {
      targetRepository: targetRepository!,
      workspaceRoot: workspace!.workspaceRoot,
      workspaceRootSource: workspace!.source,
      ...(workspace!.source === "env_fallback"
        ? {
            workspaceRootFallbackWarning:
              "ExecutionSetup에 workspacePath가 없어 서버 env clone root를 사용합니다.",
          }
        : workspace!.source === "git_repo_auto"
          ? {
              workspaceRootFallbackWarning:
                "Git 저장소를 기준으로 서버가 작업공간 경로를 자동 준비합니다.",
            }
          : {}),
      baseBranch: targetRepository!.defaultBranch,
      allowedPathGlobs,
      forbiddenPathGlobs,
      autoCommit: input.setup!.autoCommit !== false,
      autoPush: input.setup!.autoPush === true,
      autoPr: input.setup!.autoPr === true,
      ...(effectiveApi.url ? { cursorApiUrl: effectiveApi.url } : {}),
      hasCursorToken,
      hasGithubToken:
        input.setup!.hasGithubAccessToken === true ||
        Boolean(String(input.setup!.githubAccessToken ?? "").trim()),
      bridgeAvailable: cursorApiReady,
    },
  };
}

/** Best-effort diagnostic from setup row (works when readiness is blocked). */
export function formatExecutionSetupSourceGenerationDiagnosticLinesFromSetup(
  setup: ExecutionSetupSourceGenerationRow | null | undefined,
  env?: Record<string, string | undefined>,
): readonly string[] {
  const readiness = evaluateExecutionSetupSourceGenerationReadiness({ setup, env });
  if (readiness.ok) {
    return formatExecutionSetupSourceGenerationDiagnosticLines(readiness.context);
  }

  const targetRepository = setup
    ? resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: setup.gitRepoUrl,
        gitRepoName: setup.gitRepoName,
        gitRepoProvider: setup.gitRepoProvider,
        baseBranch: setup.baseBranch,
      })
    : null;
  const workspace = setup
    ? resolveSourceGenerationWorkspaceRoot({
        workspacePath: setup.workspacePath,
        targetRepository,
        env,
      })
    : null;
  const cursorAvailability = evaluateCursorExecutionAvailability({ setup });
  const hasCursorToken =
    setup?.hasCursorToken === true || Boolean(String(setup?.cursorApiToken ?? "").trim());
  const hasCursorApiUrl = Boolean(String(setup?.cursorApiUrl ?? "").trim());
  const allowedPathGlobs = setup ? parseStringArrayJson(setup.allowedPathGlobs) : [];

  return [
    "실제 소스 생성 대상:",
    `- Git 저장소: ${targetRepository?.repoFullName ?? "(미설정)"}`,
    `- 기준 브랜치: ${targetRepository?.defaultBranch ?? (setup?.baseBranch?.trim() || "(미설정)")}`,
    `- 작업 경로: ${workspace?.workspaceRoot ?? "(미설정)"} (${formatGitRepoWorkspaceSourceLabel(workspace?.source)})`,
    `- Cursor API: ${cursorAvailability.ready ? "준비됨" : "미설정"}`,
    `- Cursor 실행 모드: ${cursorAvailability.mode}`,
    `- GitHub 토큰: ${
      setup?.hasGithubAccessToken === true || Boolean(String(setup?.githubAccessToken ?? "").trim())
        ? "설정됨"
        : "미설정"
    }`,
    `- autoCommit: ${setup?.autoCommit !== false ? "on" : "off"}`,
    `- autoPush: ${setup?.autoPush === true ? "on" : "off"}`,
    `- autoPr: ${setup?.autoPr === true ? "on" : "off"}`,
    ...(allowedPathGlobs.length
      ? [`- allowedPathGlobs: ${allowedPathGlobs.join(", ")}`]
      : ["- allowedPathGlobs: (전체 허용, 금지 경로만 적용)"]),
  ];
}

export function formatExecutionSetupSourceGenerationDiagnosticLines(
  context: ExecutionSetupSourceGenerationContext | null,
): readonly string[] {
  if (!context) {
    return [
      "실제 소스 생성 대상:",
      "- Git 저장소: (미설정)",
      "- 기준 브랜치: (미설정)",
      "- 작업 경로: (미설정)",
      "- Cursor API: 미설정",
      "- GitHub 토큰: 미설정",
    ];
  }
  return [
    "실제 소스 생성 대상:",
    `- Git 저장소: ${context.targetRepository.repoFullName}`,
    `- 기준 브랜치: ${context.baseBranch}`,
    `- 작업 경로: ${context.workspaceRoot} (${formatGitRepoWorkspaceSourceLabel(context.workspaceRootSource)})`,
    ...(context.workspaceRootFallbackWarning ? [`- 참고: ${context.workspaceRootFallbackWarning}`] : []),
    `- Cursor API: ${context.bridgeAvailable ? "준비됨" : "미설정"}`,
    `- GitHub 토큰: ${context.hasGithubToken ? "설정됨" : "미설정"}`,
    `- autoCommit: ${context.autoCommit ? "on" : "off"}`,
    `- autoPush: ${context.autoPush ? "on" : "off"}`,
    `- autoPr: ${context.autoPr ? "on" : "off"}`,
    ...(context.allowedPathGlobs.length
      ? [`- allowedPathGlobs: ${context.allowedPathGlobs.join(", ")}`]
      : ["- allowedPathGlobs: (전체 허용, 금지 경로만 적용)"]),
  ];
}
