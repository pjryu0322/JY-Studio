export type CodeTaskPromptTargetRepoKind = "generated_project" | "platform";

export type CodeTaskPromptTargetContext = Readonly<{
  readonly repoFullName: string;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly repoKind: CodeTaskPromptTargetRepoKind;
  readonly allowedPathGlobs: readonly string[];
  readonly forbiddenRules: readonly string[];
  readonly projectStack?: "next" | "vite" | "react" | "unknown";
}>;

/** @deprecated Use CodeTaskPromptTargetContext.repoKind */
export type LegacyCodeTaskPromptTargetContext = Readonly<{
  targetRepoFullName: string;
  baseBranch: string;
  workBranch: string;
  targetRepoKind?: CodeTaskPromptTargetRepoKind;
  allowedPathGlobs: readonly string[];
  forbiddenPathGlobs: readonly string[];
}>;

export const GENERATED_PROJECT_FORBIDDEN_RULES: readonly string[] = [
  "package.json, lockfile 수정 금지",
  "main branch 직접 push 금지",
  "PR 생성·merge 금지",
  "무관한 대규모 리팩터링 금지",
];

export const GENERATED_PROJECT_PROBE_PATHS: readonly string[] = [
  "src/**",
  "app/**",
  "components/**",
  "lib/**",
  "hooks/**",
  "styles/**",
  "tests/**",
];

export function buildGeneratedProjectForbiddenRules(repoFullName: string): readonly string[] {
  return [
    `\`${repoFullName}\` 저장소 밖의 파일 수정 금지`,
    ...GENERATED_PROJECT_FORBIDDEN_RULES,
  ];
}

export function buildCodeTaskPromptTargetContext(input: {
  readonly repoFullName: string;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly repoKind?: CodeTaskPromptTargetRepoKind;
  readonly allowedPathGlobs?: readonly string[];
}): CodeTaskPromptTargetContext {
  const repoKind = input.repoKind ?? "generated_project";
  const repoFullName = input.repoFullName.trim();
  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: repoFullName,
    targetRepoKind: repoKind,
  });
  const forbiddenRules =
    repoKind === "platform"
      ? resolveForbiddenPathGlobsForTargetRepo({ targetRepoKind: repoKind })
      : buildGeneratedProjectForbiddenRules(repoFullName);
  return {
    repoFullName,
    baseBranch: input.baseBranch.trim() || "main",
    workBranch: input.workBranch.trim(),
    repoKind,
    allowedPathGlobs,
    forbiddenRules,
    projectStack: "unknown",
  };
}

const PLATFORM_PATH_PREFIXES = [
  "projects/jyorchestration/",
  "projects/jygallery/",
  "projects/jyaccount/",
  "projects/chunk studio/",
  "projects/chunk-studio/",
] as const;

const DEFAULT_GENERATED_ALLOWED_GLOBS: readonly string[] = [
  "src/**",
  "app/**",
  "pages/**",
  "components/**",
  "lib/**",
  "hooks/**",
  "styles/**",
  "public/**",
  "tests/**",
  "__tests__/**",
];

const GENERATED_FORBIDDEN_GLOBS: readonly string[] = [
  "../**",
  "../../**",
  "projects/JYOrchestration/**",
  "projects/JYGallery/**",
  "projects/JYAccount/**",
  "projects/Chunk Studio/**",
  "projects/chunk-studio/**",
];

export function normalizePromptPathToken(raw: string): string {
  let path = String(raw ?? "").trim();
  if (!path) return "";
  if (path.toLowerCase().startsWith("dir:")) {
    path = path.slice(4).trim();
  }
  return path.replace(/\\/g, "/");
}

export function isPlatformInternalPath(path: string): boolean {
  const normalized = normalizePromptPathToken(path).toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) return true;
  if (normalized.includes("../") || normalized.startsWith("..")) return true;
  return PLATFORM_PATH_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

export function sanitizeCandidatePathsForTargetRepo(input: {
  readonly candidatePaths: readonly string[];
  readonly targetRepoFullName: string;
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
}): {
  readonly safeCandidatePaths: readonly string[];
  readonly removedCandidatePaths: readonly string[];
  readonly warnings: readonly string[];
} {
  const kind = input.targetRepoKind ?? "generated_project";
  const safe: string[] = [];
  const removed: string[] = [];
  const warnings: string[] = [];

  for (const raw of input.candidatePaths) {
    const token = normalizePromptPathToken(raw);
    if (!token) continue;
    if (kind === "generated_project" && isPlatformInternalPath(token)) {
      removed.push(raw);
      warnings.push(`removed_platform_path:${token}`);
      continue;
    }
    safe.push(token);
  }

  return {
    safeCandidatePaths: [...new Set(safe)],
    removedCandidatePaths: removed,
    warnings,
  };
}

export function resolveDefaultAllowedPathGlobsForTargetRepo(input: {
  readonly targetRepoFullName: string;
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
  readonly projectType?: string | null;
}): readonly string[] {
  void input.targetRepoFullName;
  void input.projectType;
  const kind = input.targetRepoKind ?? "generated_project";
  if (kind === "platform") {
    return ["projects/JYOrchestration/**"];
  }
  return DEFAULT_GENERATED_ALLOWED_GLOBS;
}

export function resolveForbiddenPathGlobsForTargetRepo(input: {
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
}): readonly string[] {
  const kind = input.targetRepoKind ?? "generated_project";
  if (kind === "platform") {
    return ["../../**", "projects/JYGallery/**", "projects/JYAccount/**"];
  }
  return GENERATED_FORBIDDEN_GLOBS;
}

export function resolveEffectiveAllowedPathGlobs(input: {
  readonly allowedPathGlobs?: readonly string[];
  readonly targetRepoFullName: string;
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
}): readonly string[] {
  const fromSetup = (input.allowedPathGlobs ?? [])
    .map((g) => String(g).trim())
    .filter(Boolean);
  if (fromSetup.length) return fromSetup;
  return resolveDefaultAllowedPathGlobsForTargetRepo({
    targetRepoFullName: input.targetRepoFullName,
    targetRepoKind: input.targetRepoKind,
  });
}
