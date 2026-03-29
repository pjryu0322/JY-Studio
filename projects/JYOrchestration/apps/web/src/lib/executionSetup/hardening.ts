/** 원격 Git 저장소 도달성 프로브(로컬 클론 없음). */

function gitInfoRefsCandidates(repoUrl: string): string[] {
  const raw = repoUrl.trim().replace(/\/+$/, "");
  if (!raw) return [];
  const q = "service=git-upload-pack";
  if (raw.endsWith(".git")) {
    return [`${raw}/info/refs?${q}`];
  }
  return [`${raw}/info/refs?${q}`, `${raw}.git/info/refs?${q}`];
}

/** GitHub HTTPS URL에서 `owner/repo` 형태 추출 (실패 시 null) */
export function parseGitHubRepoFullName(repoUrl: string): string | null {
  try {
    const u = new URL(repoUrl.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "github.com") return null;
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    let repo = parts[1];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    if (!owner || !repo) return null;
    return `${owner}/${repo}`.toLowerCase();
  } catch {
    return null;
  }
}

export async function probeGitHttpRemote(repoUrl: string, timeoutMs = 12_000): Promise<{ ok: boolean; error?: string }> {
  const candidates = gitInfoRefsCandidates(repoUrl);
  if (!candidates.length) return { ok: false, error: "empty repository URL" };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let lastErr = "unreachable";
  try {
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: ac.signal,
          headers: { Accept: "*/*", "User-Agent": "JYOrchestration-execution-setup/1" },
        });
        if (res.status >= 200 && res.status < 500) {
          if (res.status === 401 || res.status === 403) {
            return { ok: true };
          }
          const text = await res.text();
          if (res.ok && (text.includes("refs/heads") || text.includes("# service=git-upload-pack"))) {
            return { ok: true };
          }
          if (res.ok) {
            return { ok: true };
          }
          lastErr = `HTTP ${res.status}`;
        } else {
          lastErr = `HTTP ${res.status}`;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = msg.includes("abort") ? "timeout" : msg;
      }
    }
    return { ok: false, error: lastErr };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * info/refs 응답에 `refs/heads/{baseBranch}` 존재 여부로 베이스 브랜치 도달 가능성 확인.
 */
export async function probeGitBaseBranchReachable(
  repoUrl: string,
  baseBranch: string,
  timeoutMs = 12_000
): Promise<{ ok: boolean; error?: string }> {
  const branch = baseBranch.trim();
  if (!branch) return { ok: false, error: "base branch가 비어 있습니다." };
  const raw = repoUrl.trim().replace(/\/+$/, "");
  if (!raw) return { ok: false, error: "empty repository URL" };
  const q = "service=git-upload-pack";
  const candidates = raw.endsWith(".git")
    ? [`${raw}/info/refs?${q}`]
    : [`${raw}/info/refs?${q}`, `${raw}.git/info/refs?${q}`];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let lastErr = "unreachable";
  try {
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: ac.signal,
          headers: { Accept: "*/*", "User-Agent": "JYOrchestration-execution-setup/1" },
        });
        if (res.status === 401 || res.status === 403) {
          return { ok: true };
        }
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`;
          continue;
        }
        const text = await res.text();
        const needle = `refs/heads/${branch}`;
        if (text.includes(needle)) {
          return { ok: true };
        }
        lastErr = `브랜치 '${branch}' 를 refs 에서 찾지 못했습니다.`;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = msg.includes("abort") ? "timeout" : msg;
      }
    }
    return { ok: false, error: lastErr };
  } finally {
    clearTimeout(timer);
  }
}

