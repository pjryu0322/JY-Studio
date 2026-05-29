import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseGithubComOwnerRepoFromUrl } from "@/lib/integration/githubRestCommon";

const execFileAsync = promisify(execFile);

async function git(
  workdir: string,
  args: readonly string[],
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const r = (await execFileAsync("git", [...args], {
    cwd: workdir,
    maxBuffer: 4 * 1024 * 1024,
    encoding: "utf8",
  })) as string | { readonly stdout?: string; readonly stderr?: string };
  const stdout = typeof r === "string" ? r.trim() : String(r.stdout ?? "").trim();
  const stderr = typeof r === "string" ? "" : String(r.stderr ?? "").trim();
  return { stdout, stderr };
}

/** Parse owner/repo from https or git@github.com remote URLs. */
export function parseOwnerRepoFromGitRemoteUrl(remoteUrl: string): Readonly<{ owner: string; repo: string }> | null {
  const trimmed = String(remoteUrl ?? "").trim();
  if (!trimmed) return null;

  const fromHttps = parseGithubComOwnerRepoFromUrl(trimmed);
  if (fromHttps) return fromHttps;

  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (ssh) {
    const owner = ssh[1]?.trim();
    let repo = ssh[2]?.trim() ?? "";
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    if (owner && repo) return { owner, repo };
  }

  const scp = trimmed.match(/^[^:]+\/[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
  if (scp) {
    const owner = scp[1]?.trim();
    let repo = scp[2]?.trim() ?? "";
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    if (owner && repo) return { owner, repo };
  }

  return null;
}

export function formatWorkspaceOriginMismatchMessage(input: {
  readonly expectedRepoFullName: string;
  readonly actualRemote?: string | null;
}): string {
  return [
    "workspacePath의 Git origin이 환경설정 Git 저장소와 일치하지 않습니다.",
    `- 환경설정 저장소: ${input.expectedRepoFullName}`,
    `- workspace origin: ${input.actualRemote?.trim() || "(없음)"}`,
  ].join("\n");
}

export async function validateWorkspaceMatchesTargetRepository(input: {
  readonly workspacePath: string;
  readonly targetRepoFullName: string;
}): Promise<
  Readonly<{ readonly ok: true }> | Readonly<{ readonly ok: false; readonly reason: string; readonly actualRemote?: string }>
> {
  const workdir = String(input.workspacePath ?? "").trim();
  const expected = String(input.targetRepoFullName ?? "").trim();
  if (!workdir) {
    return { ok: false, reason: "workspacePath가 비어 있습니다." };
  }
  if (!expected) {
    return { ok: false, reason: "대상 Git 저장소가 비어 있습니다." };
  }

  try {
    await git(workdir, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { ok: false, reason: "workspacePath가 Git worktree가 아닙니다." };
  }

  let remoteUrl = "";
  try {
    remoteUrl = (await git(workdir, ["remote", "get-url", "origin"])).stdout;
  } catch {
    return { ok: false, reason: "workspacePath에 origin remote가 없습니다.", actualRemote: undefined };
  }

  if (!remoteUrl) {
    return { ok: false, reason: "workspacePath에 origin remote가 없습니다.", actualRemote: undefined };
  }

  const parsed = parseOwnerRepoFromGitRemoteUrl(remoteUrl);
  if (!parsed) {
    return {
      ok: false,
      reason: "workspace origin URL을 파싱할 수 없습니다.",
      actualRemote: remoteUrl,
    };
  }

  const actualFullName = `${parsed.owner}/${parsed.repo}`;
  if (actualFullName.toLowerCase() !== expected.toLowerCase()) {
    return {
      ok: false,
      reason: formatWorkspaceOriginMismatchMessage({
        expectedRepoFullName: expected,
        actualRemote: actualFullName,
      }),
      actualRemote: actualFullName,
    };
  }

  return { ok: true };
}
