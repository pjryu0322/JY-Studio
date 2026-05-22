/**
 * GitHub repository name candidates from project metadata.
 */

import { shortIdFromUuid } from "@/lib/execution/branchSlug";

const DEFAULT_REPO_PREFIX = "jyo-";
const MAX_GITHUB_REPO_NAME_LEN = 100;

function normalizeRepoSlugSegment(input: string, max: number): string {
  return String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, max);
}

export function toSafeGithubRepoName(input: string, fallback: string): string {
  const innerMax = MAX_GITHUB_REPO_NAME_LEN - DEFAULT_REPO_PREFIX.length;
  const inner = normalizeRepoSlugSegment(input, innerMax);
  if (inner && /[a-z0-9]/.test(inner)) {
    const name = `${DEFAULT_REPO_PREFIX}${inner}`.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
    return name.slice(0, MAX_GITHUB_REPO_NAME_LEN);
  }

  const fb = normalizeRepoSlugSegment(fallback, MAX_GITHUB_REPO_NAME_LEN);
  if (!fb) return "jyo-project";
  if (fb.startsWith(DEFAULT_REPO_PREFIX)) return fb;
  return `${DEFAULT_REPO_PREFIX}${fb}`.replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_GITHUB_REPO_NAME_LEN);
}

export function buildRepoNameCandidate(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly prefix?: string;
}): { readonly repoName: string; readonly reason: string } {
  const prefix = String(input.prefix ?? DEFAULT_REPO_PREFIX).trim() || DEFAULT_REPO_PREFIX;
  const shortId = shortIdFromUuid(input.projectId, 8);
  const fallback = `${prefix.replace(/-$/, "")}-p-${shortId}`.slice(0, MAX_GITHUB_REPO_NAME_LEN);

  const fromName = toSafeGithubRepoName(input.projectName, fallback);
  const usedFallback = fromName === fallback || fromName.endsWith(`p-${shortId}`);
  return {
    repoName: fromName,
    reason: usedFallback
      ? "project_name_not_ascii_safe_using_fallback"
      : "derived_from_project_name",
  };
}
