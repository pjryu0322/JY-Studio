const PROTECTED_DEFAULT_BRANCHES = new Set(["main", "master"]);

export function maskSecret(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "(empty)";
  if (raw.length <= 8) return "****";
  return `${raw.slice(0, 4)}****${raw.slice(-3)}`;
}

export function sanitizeGitErrorMessage(message: string, token?: string): string {
  let sanitized = String(message ?? "");
  const tokenValue = String(token ?? "").trim();
  if (tokenValue) {
    sanitized = sanitized.split(tokenValue).join(maskSecret(tokenValue));
  }
  sanitized = sanitized.replace(/x-access-token:[^\s@]+/gi, "x-access-token:****");
  sanitized = sanitized.replace(/https:\/\/x-access-token:[^@\s]+@/gi, "https://x-access-token:****@");
  sanitized = sanitized.replace(/github_pat_[A-Za-z0-9_]+/g, (match) => maskSecret(match));
  sanitized = sanitized.replace(/gh[pousr]_[A-Za-z0-9_]+/g, (match) => maskSecret(match));
  return sanitized;
}

export function buildGithubAuthenticatedPushUrl(input: {
  readonly repoFullName: string;
  readonly githubAccessToken: string;
}): string | null {
  const repoFullName = String(input.repoFullName ?? "").trim();
  const token = String(input.githubAccessToken ?? "").trim();
  if (!repoFullName.includes("/") || !token) return null;
  const [owner, repo] = repoFullName.split("/", 2);
  if (!owner || !repo) return null;
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`;
}

export function validateScmPushBranchName(input: {
  readonly branchName: string;
  readonly baseBranch?: string;
}): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  const branchName = String(input.branchName ?? "").trim();
  const baseBranch = String(input.baseBranch ?? "").trim();
  if (!branchName) {
    return { ok: false, message: "SCM push 차단: 작업 브랜치가 없습니다." };
  }
  if (PROTECTED_DEFAULT_BRANCHES.has(branchName.toLowerCase())) {
    return { ok: false, message: "SCM push 차단: main/master 브랜치 직접 push는 허용되지 않습니다." };
  }
  if (baseBranch && branchName === baseBranch) {
    return { ok: false, message: "SCM push 차단: base 브랜치로 직접 push할 수 없습니다." };
  }
  if (!(branchName.startsWith("wip/") || branchName.startsWith("feature/"))) {
    return {
      ok: false,
      message: "SCM push 차단: wip/* 또는 feature/* 작업 브랜치만 push할 수 있습니다.",
    };
  }
  return { ok: true };
}
