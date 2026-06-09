import { githubRestApiBase } from "@/lib/integration/githubRestCommon";

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "JYOrchestration/github-repo-contents",
  };
}

async function githubJson<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: T | null; text: string }> {
  const res = await fetch(url, {
    ...init,
    headers: { ...ghHeaders(token), ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text().catch(() => "");
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function encodeRepoPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export async function getRepoUtf8FileIfExists(input: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly path: string;
  readonly ref: string;
}): Promise<{ contentUtf8: string; sha: string } | null> {
  const base = githubRestApiBase();
  const encPath = encodeRepoPath(input.path);
  const r = await githubJson<{ type?: string; encoding?: string; content?: string; sha?: string }>(
    input.token,
    `${base}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encPath}?ref=${encodeURIComponent(input.ref)}`,
  );
  if (!r.ok || !r.json || r.json.type !== "file") return null;
  const encoding = String(r.json.encoding ?? "");
  const content = String(r.json.content ?? "").replace(/\n/g, "");
  const sha = String(r.json.sha ?? "").trim();
  if (!sha || encoding !== "base64") return null;
  try {
    return { contentUtf8: Buffer.from(content, "base64").toString("utf8"), sha };
  } catch {
    return null;
  }
}

export async function putRepoUtf8File(input: {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly path: string;
  readonly branch: string;
  readonly message: string;
  readonly contentUtf8: string;
  readonly sha: string | null;
}): Promise<{ ok: true; commitSha: string } | { ok: false; error: string }> {
  const base = githubRestApiBase();
  const encPath = encodeRepoPath(input.path);
  const body: Record<string, string> = {
    message: input.message,
    content: Buffer.from(input.contentUtf8, "utf8").toString("base64"),
    branch: input.branch,
  };
  if (input.sha) body.sha = input.sha;
  const r = await githubJson<{ commit?: { sha?: string } }>(
    input.token,
    `${base}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encPath}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) return { ok: false, error: `GITHUB_PUT_${r.status}` };
  const commitSha = String(r.json?.commit?.sha ?? "").trim();
  if (!commitSha) return { ok: false, error: "GITHUB_PUT_MISSING_COMMIT_SHA" };
  return { ok: true, commitSha };
}
