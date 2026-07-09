import type { GitHubApiFetch } from "./github-api-client";
import { GitHubDiscoveryError } from "./github-auto-collect-types";

function buildHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "JYKStore-GitHub-Content-Fetch",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function isBinaryLikeContent(content: string): boolean {
  if (content.includes("\0")) return true;
  let nonPrintable = 0;
  const sample = content.slice(0, 8000);
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code === 127) nonPrintable += 1;
  }
  return sample.length > 0 && nonPrintable / sample.length > 0.05;
}

export async function fetchGitHubTextBlob(params: {
  owner: string;
  repo: string;
  path: string;
  sha: string;
  maxFileBytes: number;
  fetchImpl?: GitHubApiFetch;
  token?: string;
}): Promise<{
  path: string;
  content: string;
  size: number;
  encoding: "utf-8";
}> {
  const { owner, repo, path, sha, maxFileBytes, fetchImpl = fetch, token } = params;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`;
  const response = await fetchImpl(url, { headers: buildHeaders(token) });
  if (!response.ok) {
    throw new GitHubDiscoveryError(
      "GITHUB_CONTENT_FETCH_FAILED",
      "GitHub blob content를 가져오지 못했습니다.",
      502,
    );
  }
  const raw = (await response.json()) as {
    content?: string;
    encoding?: string;
    size?: number;
  };
  const reportedSize = raw.size ?? 0;
  if (reportedSize > maxFileBytes) {
    throw new GitHubDiscoveryError(
      "GITHUB_CONTENT_FETCH_FAILED",
      "파일 크기가 허용 한도를 초과했습니다.",
      400,
    );
  }
  if (!raw.content || raw.encoding !== "base64") {
    throw new GitHubDiscoveryError(
      "GITHUB_CONTENT_FETCH_FAILED",
      "GitHub blob content 형식이 올바르지 않습니다.",
      502,
    );
  }
  const buffer = Buffer.from(raw.content.replace(/\n/g, ""), "base64");
  if (buffer.byteLength > maxFileBytes) {
    throw new GitHubDiscoveryError(
      "GITHUB_CONTENT_FETCH_FAILED",
      "파일 크기가 허용 한도를 초과했습니다.",
      400,
    );
  }
  const content = buffer.toString("utf8");
  if (isBinaryLikeContent(content)) {
    throw new GitHubDiscoveryError(
      "GITHUB_CONTENT_FETCH_FAILED",
      "바이너리로 의심되는 content입니다.",
      400,
    );
  }
  return {
    path,
    content,
    size: buffer.byteLength,
    encoding: "utf-8",
  };
}
