import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import {
  getCursorBridgeAvailability,
  resolveCursorBridgeCloneRoot,
} from "@/lib/prototype/cursorBridgeRuntime";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
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
}>;

export type ExecutionSetupSourceGenerationContext = Readonly<{
  readonly targetRepository: ProjectTargetRepository;
  readonly workspaceRoot: string;
  readonly workspaceRootSource: "execution_setup" | "env_fallback";
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
    env: input.env,
  }).ready;
}

export function resolveSourceGenerationWorkspaceRoot(input: {
  readonly workspacePath?: string | null;
  readonly env?: Record<string, string | undefined>;
}):
  | Readonly<{ readonly workspaceRoot: string; readonly source: "execution_setup" | "env_fallback" }>
  | null {
  const fromSetup = String(input.workspacePath ?? "").trim();
  if (fromSetup) {
    return { workspaceRoot: fromSetup, source: "execution_setup" };
  }
  const fromEnv = resolveCursorBridgeCloneRoot(input.env ?? {});
  if (fromEnv) {
    return { workspaceRoot: fromEnv, source: "env_fallback" };
  }
  return null;
}

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
    env: input.env,
  });
  if (!workspace) {
    missing.push("workspacePath 없음");
  }

  const cursorAvailability = evaluateCursorExecutionAvailability({
    setup: input.setup,
    env: input.env,
  });
  const bridgeAvailable = cursorAvailability.ready;
  const hasCursorToken =
    input.setup.hasCursorToken === true || Boolean(String(input.setup.cursorApiToken ?? "").trim());
  const hasCursorApiUrl = Boolean(String(input.setup.cursorApiUrl ?? "").trim());
  if (!bridgeAvailable) {
    if (cursorAvailability.mode === "cursor_api") {
      missing.push(cursorAvailability.reason);
    } else {
      missing.push("Cursor API/Bridge 설정 없음");
    }
  }

  if (missing.length) {
    return {
      ok: false,
      message: [
        "Cursor 실행 요청이 차단되었습니다.",
        "",
        "부족 항목:",
        ...missing.map((m) => `- ${m}`),
        ...(workspace?.source === "env_fallback"
          ? ["", "참고: workspacePath가 없어 서버 환경 변수 workdir을 fallback으로 사용합니다."]
          : []),
      ].join("\n"),
      missing,
    };
  }

  const allowedPathGlobs = parseStringArrayJson(input.setup!.allowedPathGlobs);
  const forbiddenPathGlobs = defaultForbiddenTargetPathGlobs();

  return {
    ok: true,
    context: {
      targetRepository: targetRepository!,
      workspaceRoot: workspace!.workspaceRoot,
      workspaceRootSource: workspace!.source,
      ...(workspace!.source === "env_fallback"
        ? {
            workspaceRootFallbackWarning:
              "ExecutionSetup.workspacePath가 없어 서버 환경 변수 workdir을 사용합니다.",
          }
        : {}),
      baseBranch: targetRepository!.defaultBranch,
      allowedPathGlobs,
      forbiddenPathGlobs,
      autoCommit: input.setup!.autoCommit !== false,
      autoPush: input.setup!.autoPush === true,
      autoPr: input.setup!.autoPr === true,
      ...(hasCursorApiUrl ? { cursorApiUrl: String(input.setup!.cursorApiUrl).trim() } : {}),
      hasCursorToken,
      hasGithubToken:
        input.setup!.hasGithubAccessToken === true ||
        Boolean(String(input.setup!.githubAccessToken ?? "").trim()),
      bridgeAvailable,
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
    ? resolveSourceGenerationWorkspaceRoot({ workspacePath: setup.workspacePath, env })
    : null;
  const bridgeAvailable = getCursorBridgeAvailability({ env }).available;
  const hasCursorToken =
    setup?.hasCursorToken === true || Boolean(String(setup?.cursorApiToken ?? "").trim());
  const hasCursorApiUrl = Boolean(String(setup?.cursorApiUrl ?? "").trim());
  const allowedPathGlobs = setup ? parseStringArrayJson(setup.allowedPathGlobs) : [];

  return [
    "실제 소스 생성 대상:",
    `- Git 저장소: ${targetRepository?.repoFullName ?? "(미설정)"}`,
    `- 기준 브랜치: ${targetRepository?.defaultBranch ?? (setup?.baseBranch?.trim() || "(미설정)")}`,
    `- 작업 경로: ${workspace?.workspaceRoot ?? (setup?.workspacePath?.trim() || "(미설정)")}`,
    ...(workspace?.source === "env_fallback"
      ? ["- 참고: workspacePath가 없어 서버 환경 변수 workdir을 fallback으로 사용합니다."]
      : []),
    `- Cursor API: ${hasCursorToken && hasCursorApiUrl ? "설정됨" : "미설정"}`,
    `- Cursor Bridge: ${bridgeAvailable ? "연결됨" : "미연결"}`,
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
    `- 작업 경로: ${context.workspaceRoot}`,
    ...(context.workspaceRootFallbackWarning ? [`- 참고: ${context.workspaceRootFallbackWarning}`] : []),
    `- Cursor API: ${context.hasCursorToken ? "설정됨" : "미설정"}`,
    `- Cursor Bridge: ${context.bridgeAvailable ? "연결됨" : "미연결"}`,
    `- GitHub 토큰: ${context.hasGithubToken ? "설정됨" : "미설정"}`,
    `- autoCommit: ${context.autoCommit ? "on" : "off"}`,
    `- autoPush: ${context.autoPush ? "on" : "off"}`,
    `- autoPr: ${context.autoPr ? "on" : "off"}`,
    ...(context.allowedPathGlobs.length
      ? [`- allowedPathGlobs: ${context.allowedPathGlobs.join(", ")}`]
      : ["- allowedPathGlobs: (전체 허용, 금지 경로만 적용)"]),
  ];
}
