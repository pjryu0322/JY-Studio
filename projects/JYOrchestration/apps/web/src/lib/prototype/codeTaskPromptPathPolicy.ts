export type CodeTaskPromptTargetRepoKind = "generated_project" | "platform";

export type CodeTaskPromptTargetContext = Readonly<{
  targetRepoFullName: string;
  baseBranch: string;
  workBranch: string;
  targetRepoKind?: CodeTaskPromptTargetRepoKind;
  allowedPathGlobs: readonly string[];
  forbiddenPathGlobs: readonly string[];
}>;

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
