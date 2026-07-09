import { GitHubDiscoveryError } from "./github-auto-collect-types";
import type { ParsedGitHubRepositoryUrl } from "./github-auto-collect-types";

const GITHUB_HOST = "github.com";

function rejectInvalid(message: string): never {
  throw new GitHubDiscoveryError("INVALID_GITHUB_URL", message, 400);
}

export function parseGitHubRepositoryUrl(input: string): ParsedGitHubRepositoryUrl {
  const trimmed = input?.trim();
  if (!trimmed) {
    throw new GitHubDiscoveryError(
      "REPOSITORY_URL_REQUIRED",
      "repositoryUrl이 필요합니다.",
      400,
    );
  }

  if (/^git@github\.com:/i.test(trimmed) || trimmed.startsWith("git@")) {
    rejectInvalid("github.com 공개 Repository URL만 입력할 수 있습니다.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    rejectInvalid("github.com 공개 Repository URL만 입력할 수 있습니다.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    rejectInvalid("github.com 공개 Repository URL만 입력할 수 있습니다.");
  }

  const host = url.hostname.toLowerCase();
  if (host === "raw.githubusercontent.com" || host === "gist.github.com") {
    rejectInvalid("github.com 공개 Repository URL만 입력할 수 있습니다.");
  }
  if (host !== GITHUB_HOST) {
    rejectInvalid("github.com 공개 Repository URL만 입력할 수 있습니다.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new GitHubDiscoveryError(
      "INVALID_REPOSITORY_URL",
      "owner와 repo를 추출할 수 없습니다.",
      400,
    );
  }

  const owner = segments[0]!;
  let repo = segments[1]!;
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  if (!owner || !repo || /[./]/.test(owner)) {
    throw new GitHubDiscoveryError(
      "INVALID_REPOSITORY_URL",
      "owner와 repo를 추출할 수 없습니다.",
      400,
    );
  }

  let ref: string | undefined;
  let path: string | undefined;

  if (segments[2] === "tree" && segments[3]) {
    ref = segments[3];
    if (segments.length > 4) {
      path = segments.slice(4).join("/");
    }
  } else if (segments[2] === "blob" && segments[3]) {
    ref = segments[3];
    if (segments.length > 4) {
      path = segments.slice(4).join("/");
    }
  }

  const normalizedRepositoryUrl = `https://${GITHUB_HOST}/${owner}/${repo}`;

  return {
    owner,
    repo,
    normalizedRepositoryUrl,
    inputUrl: trimmed,
    ref,
    path,
  };
}
