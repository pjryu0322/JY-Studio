import { resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";

export function composeGithubPagesPreviewUrlFromOwnerRepo(input: { owner: string; repo: string }): string | null {
  const owner = String(input.owner ?? "").trim();
  const repo = String(input.repo ?? "").trim();
  if (!owner || !repo) return null;
  if (!/^[A-Za-z0-9-]+$/.test(owner)) return null;
  // repo can include dots/underscores but keep strict-ish to avoid producing nonsense
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  return `https://${owner}.github.io/${repo}/`;
}

export function composeGithubPagesPreviewUrlFromRepoUrl(repoUrl: string): { owner: string; repo: string; url: string } | null {
  const parsed = resolveGithubOwnerRepoStrict(repoUrl);
  if (!parsed) return null;
  const url = composeGithubPagesPreviewUrlFromOwnerRepo({ owner: parsed.owner, repo: parsed.repo });
  if (!url) return null;
  return { owner: parsed.owner, repo: parsed.repo, url };
}

export function githubPagesSettingsUrl(owner: string, repo: string): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/settings/pages`;
}

