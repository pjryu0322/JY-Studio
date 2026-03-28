/** Remote probes for Execution Setup (relay: no local repo path checks). */

function gitInfoRefsCandidates(repoUrl: string): string[] {
  const raw = repoUrl.trim().replace(/\/+$/, "");
  if (!raw) return [];
  const q = "service=git-upload-pack";
  if (raw.endsWith(".git")) {
    return [`${raw}/info/refs?${q}`];
  }
  return [`${raw}/info/refs?${q}`, `${raw}.git/info/refs?${q}`];
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

export async function probeCursorExecutor(
  baseUrl: string,
  token: string | null,
  timeoutMs = 12_000
): Promise<{ ok: boolean; error?: string }> {
  const root = baseUrl.trim().replace(/\/+$/, "");
  if (!root) return { ok: false, error: "empty executor URL" };

  const headers: Record<string, string> = {
    Accept: "*/*",
    "User-Agent": "JYOrchestration-execution-setup/1",
  };
  const t = token?.trim();
  if (t) headers.Authorization = `Bearer ${t}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let lastErr = "unreachable";
  try {
    for (const method of ["GET", "HEAD"] as const) {
      try {
        const res = await fetch(root, { method, headers, redirect: "follow", signal: ac.signal });
        if (res.status < 500) {
          return { ok: true };
        }
        lastErr = `HTTP ${res.status}`;
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
