const DEFAULT_FORBIDDEN_PATH_GLOBS = [
  ".git/**",
  ".env",
  ".env.*",
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
] as const;

function normalizeRepoRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function globToRegExp(glob: string): RegExp {
  const g = normalizeRepoRelativePath(glob);
  let pattern = "^";
  for (let i = 0; i < g.length; i += 1) {
    const ch = g[i]!;
    if (ch === "*") {
      if (g[i + 1] === "*") {
        pattern += ".*";
        i += 1;
        if (g[i + 1] === "/") i += 1;
      } else {
        pattern += "[^/]*";
      }
      continue;
    }
    if (ch === "?") {
      pattern += "[^/]";
      continue;
    }
    pattern += ch.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  pattern += "$";
  return new RegExp(pattern);
}

function pathMatchesGlob(filePath: string, glob: string): boolean {
  const normalized = normalizeRepoRelativePath(filePath);
  const re = globToRegExp(glob);
  if (re.test(normalized)) return true;
  if (glob.endsWith("/**")) {
    const prefix = glob.slice(0, -3);
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  }
  return false;
}

function pathMatchesAnyGlob(filePath: string, globs: readonly string[]): boolean {
  return globs.some((glob) => pathMatchesGlob(filePath, glob));
}

export function defaultForbiddenTargetPathGlobs(): readonly string[] {
  return [...DEFAULT_FORBIDDEN_PATH_GLOBS];
}

export function validateTargetRepositoryChangedFiles(input: {
  readonly changedFiles: readonly string[];
  readonly allowedPathGlobs: readonly string[];
  readonly forbiddenPathGlobs?: readonly string[];
}): Readonly<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  const files = input.changedFiles.map((f) => normalizeRepoRelativePath(f)).filter(Boolean);
  if (!files.length) {
    return { ok: false, reason: "변경 파일이 없습니다." };
  }

  const forbidden = [
    ...defaultForbiddenTargetPathGlobs(),
    ...(input.forbiddenPathGlobs ?? []).map((g) => String(g).trim()).filter(Boolean),
  ];
  const blocked = files.filter((file) => pathMatchesAnyGlob(file, forbidden));
  if (blocked.length) {
    return {
      ok: false,
      reason: `금지 경로 변경이 포함되어 있습니다: ${blocked.slice(0, 3).join(", ")}`,
    };
  }

  const allowed = input.allowedPathGlobs.map((g) => String(g).trim()).filter(Boolean);
  if (allowed.length) {
    const outside = files.filter((file) => !pathMatchesAnyGlob(file, allowed));
    if (outside.length) {
      return {
        ok: false,
        reason: `허용 경로(allowedPathGlobs) 밖 변경이 있습니다: ${outside.slice(0, 3).join(", ")}`,
      };
    }
  }

  return { ok: true };
}
