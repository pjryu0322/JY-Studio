/** Path + remote probes for Execution Setup (F-1-3-6 hardening). */

const PATH_CASE_INSENSITIVE = process.platform === "win32";

export function normalizeFsPath(p: string): string {
  return p.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

/** workspacePath + "/projects/{projectId}" (slug 미사용 시 project id) */
export function expectedProjectDirectoryRoot(workspacePath: string, projectId: string): string {
  const ws = normalizeFsPath(workspacePath);
  const id = String(projectId ?? "").trim();
  if (!ws || !id) return "";
  return `${ws}/projects/${id}`;
}

export function isProjectRootUnderCurrentProject(
  projectRootPath: string,
  workspacePath: string,
  projectId: string
): boolean {
  const root = normalizeFsPath(projectRootPath);
  const expected = expectedProjectDirectoryRoot(workspacePath, projectId);
  if (!root || !expected) return false;
  const eq = (a: string, b: string) => (PATH_CASE_INSENSITIVE ? a.toLowerCase() === b.toLowerCase() : a === b);
  const prefix = (a: string, b: string) =>
    PATH_CASE_INSENSITIVE ? a.toLowerCase().startsWith(b.toLowerCase() + "/") : a.startsWith(b + "/");
  return eq(root, expected) || prefix(root, expected);
}

export const PROJECT_ROOT_PATH_ERROR =
  "projectRootPath must be inside the current project directory";

export function assertProjectRootPathOrThrow(
  projectRootPath: string,
  workspacePath: string,
  projectId: string
): void {
  const ws = workspacePath.trim();
  const pr = projectRootPath.trim();
  if (!ws || !pr) return;
  if (!isProjectRootUnderCurrentProject(pr, ws, projectId)) {
    throw new Error(PROJECT_ROOT_PATH_ERROR);
  }
}

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
