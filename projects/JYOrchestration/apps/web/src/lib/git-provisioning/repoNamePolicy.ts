/**
 * GitHub repository name validation (user-provided, ASCII-only).
 * Project.name is never used to derive repo names.
 */

export const MAX_GITHUB_REPO_NAME_LEN = 100;

const REPO_NAME_CHARS = /^[a-zA-Z0-9._-]+$/;
const RESERVED_REPO_NAMES = new Set([".", ".."]);

export type GithubRepoNameValidationReason =
  | "missing"
  | "not_ascii"
  | "invalid_chars"
  | "too_long"
  | "reserved"
  | "invalid_edge"
  | "owner_repo_format"
  | "url_format";

export function normalizeGithubRepoName(input: string): string {
  return String(input ?? "").trim();
}

export function validateGithubRepoName(input: string): {
  readonly ok: boolean;
  readonly repoName?: string;
  readonly reason?: GithubRepoNameValidationReason;
  readonly message?: string;
} {
  const raw = normalizeGithubRepoName(input);
  if (!raw) {
    return { ok: false, reason: "missing", message: "GitHub repository name is required." };
  }
  if (
    raw.includes("://") ||
    /^https?:/i.test(raw) ||
    /^github\.com\//i.test(raw) ||
    raw.includes("\\")
  ) {
    return {
      ok: false,
      reason: "url_format",
      message: "Enter repository name only, not a URL.",
    };
  }
  if (raw.includes("/")) {
    return {
      ok: false,
      reason: "owner_repo_format",
      message: "Enter repository name only, not owner/repo.",
    };
  }
  if (/\s/.test(raw)) {
    return { ok: false, reason: "invalid_chars", message: "Repository name cannot contain spaces." };
  }
  if (RESERVED_REPO_NAMES.has(raw)) {
    return { ok: false, reason: "reserved", message: 'Repository name cannot be "." or "..".' };
  }
  if (/^\./.test(raw) || /\.$/.test(raw)) {
    return {
      ok: false,
      reason: "invalid_edge",
      message: "Repository name cannot start or end with a period.",
    };
  }
  if (!REPO_NAME_CHARS.test(raw)) {
    if (/[^\x00-\x7F]/.test(raw)) {
      return {
        ok: false,
        reason: "not_ascii",
        message:
          "Repository name must use ASCII letters, numbers, hyphen, underscore, or period.",
      };
    }
    return {
      ok: false,
      reason: "invalid_chars",
      message: "Repository name may only contain a-z, A-Z, 0-9, hyphen, underscore, and period.",
    };
  }
  if (raw.length > MAX_GITHUB_REPO_NAME_LEN) {
    return {
      ok: false,
      reason: "too_long",
      message: `Repository name must be at most ${MAX_GITHUB_REPO_NAME_LEN} characters.`,
    };
  }
  return { ok: true, repoName: raw };
}

/** Extract repo segment from ExecutionSetup.gitRepoName (`owner/repo` or bare repo). */
export function repoSlugFromGitRepoName(gitRepoName: string | null | undefined): string | null {
  const raw = String(gitRepoName ?? "").trim();
  if (!raw || raw.includes("://") || raw.includes("\\")) return null;

  let repoPart = raw;
  if (raw.includes("/")) {
    const segments = raw.split("/").filter(Boolean);
    if (segments.length < 1) return null;
    repoPart = segments[segments.length - 1] ?? "";
  }
  repoPart = repoPart.replace(/\.git$/i, "").trim();
  if (!repoPart) return null;

  const validated = validateGithubRepoName(repoPart);
  return validated.ok ? validated.repoName!.toLowerCase() : null;
}
