import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROTECTED_DEFAULT_BRANCHES = new Set(["main", "master"]);

export function maskSecret(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "(empty)";
  if (raw.length <= 8) return "****";
  return `${raw.slice(0, 4)}****${raw.slice(-3)}`;
}

export function sanitizeGitErrorMessage(message: string, token?: string): string {
  let sanitized = String(message ?? "");
  const tokenValue = String(token ?? "").trim();
  if (tokenValue) {
    sanitized = sanitized.split(tokenValue).join(maskSecret(tokenValue));
  }
  sanitized = sanitized.replace(/x-access-token:[^\s@]+/gi, "x-access-token:****");
  sanitized = sanitized.replace(/https:\/\/x-access-token:[^@\s]+@/gi, "https://x-access-token:****@");
  sanitized = sanitized.replace(/github_pat_[A-Za-z0-9_]+/g, (match) => maskSecret(match));
  sanitized = sanitized.replace(/gh[pousr]_[A-Za-z0-9_]+/g, (match) => maskSecret(match));
  return sanitized;
}

export function buildGithubAuthenticatedPushUrl(input: {
  readonly repoFullName: string;
  readonly githubAccessToken: string;
}): string | null {
  const repoFullName = String(input.repoFullName ?? "").trim();
  const token = String(input.githubAccessToken ?? "").trim();
  if (!repoFullName.includes("/") || !token) return null;
  const [owner, repo] = repoFullName.split("/", 2);
  if (!owner || !repo) return null;
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${repo}.git`;
}

export function validateScmPushBranchName(input: {
  readonly branchName: string;
  readonly baseBranch?: string;
}): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  const branchName = String(input.branchName ?? "").trim();
  const baseBranch = String(input.baseBranch ?? "").trim();
  if (!branchName) {
    return { ok: false, message: "SCM push 차단: 작업 브랜치가 없습니다." };
  }
  if (PROTECTED_DEFAULT_BRANCHES.has(branchName.toLowerCase())) {
    return { ok: false, message: "SCM push 차단: main/master 브랜치 직접 push는 허용되지 않습니다." };
  }
  if (baseBranch && branchName === baseBranch) {
    return { ok: false, message: "SCM push 차단: base 브랜치로 직접 push할 수 없습니다." };
  }
  if (!(branchName.startsWith("wip/") || branchName.startsWith("feature/"))) {
    return {
      ok: false,
      message: "SCM push 차단: wip/* 또는 feature/* 작업 브랜치만 push할 수 있습니다.",
    };
  }
  return { ok: true };
}

async function git(
  workdir: string,
  args: readonly string[],
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const r = await execFileAsync("git", [...args], {
    cwd: workdir,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });
  return {
    stdout: String(r.stdout ?? "").trim(),
    stderr: String(r.stderr ?? "").trim(),
  };
}

function commitShaMatches(expected: string, actual: string): boolean {
  const exp = expected.trim().toLowerCase();
  const act = actual.trim().toLowerCase();
  if (!exp || !act) return false;
  return act === exp || act.startsWith(exp) || exp.startsWith(act);
}

export async function verifyWorktreeHeadForPlatformScm(input: {
  readonly workdir: string;
  readonly expectedBranchName: string;
  readonly expectedCommitSha: string;
  readonly baseBranch?: string;
}): Promise<
  Readonly<{
    readonly ok: boolean;
    readonly message?: string;
    readonly actualBranchName?: string;
    readonly actualCommitSha?: string;
    readonly log: readonly string[];
  }>
> {
  const log: string[] = [];
  const expectedCommitSha = String(input.expectedCommitSha ?? "").trim();
  const expectedBranchName = String(input.expectedBranchName ?? "").trim();

  const branchPolicy = validateScmPushBranchName({
    branchName: expectedBranchName,
    baseBranch: input.baseBranch,
  });
  if (!branchPolicy.ok) {
    log.push(`[SCM][VERIFY] ${branchPolicy.message}`);
    return { ok: false, message: branchPolicy.message, log };
  }

  if (!expectedCommitSha || expectedCommitSha.startsWith("wip-stub")) {
    const message = "SCM push 차단: wip-stub 또는 유효하지 않은 commit SHA입니다.";
    log.push(`[SCM][VERIFY] ${message}`);
    return { ok: false, message, log };
  }

  try {
    const inside = (await git(input.workdir, ["rev-parse", "--is-inside-work-tree"])).stdout;
    if (inside !== "true") {
      const message = "SCM push 차단: Git worktree가 아닙니다.";
      log.push(`[SCM][VERIFY] ${message}`);
      return { ok: false, message, log };
    }
    log.push("[SCM][VERIFY] worktree OK");

    const actualBranchName = (await git(input.workdir, ["branch", "--show-current"])).stdout.trim();
    const actualCommitSha = (await git(input.workdir, ["rev-parse", "HEAD"])).stdout.trim();
    log.push(`[SCM][VERIFY] branch=${actualBranchName} head=${actualCommitSha.slice(0, 12)}`);

    if (actualBranchName !== expectedBranchName) {
      const message = "SCM push 차단: worktree branch가 Cursor 결과 branch와 일치하지 않습니다.";
      log.push(`[SCM][VERIFY] ${message}`);
      return { ok: false, message, actualBranchName, actualCommitSha, log };
    }

    if (!commitShaMatches(expectedCommitSha, actualCommitSha)) {
      const message =
        "SCM push 차단: worktree HEAD가 Cursor 결과 commit과 일치하지 않습니다.";
      log.push(`[SCM][VERIFY] ${message}`);
      return { ok: false, message, actualBranchName, actualCommitSha, log };
    }

    return { ok: true, actualBranchName, actualCommitSha, log };
  } catch (error) {
    const message = sanitizeGitErrorMessage(error instanceof Error ? error.message : String(error));
    log.push(`[SCM][VERIFY] failed: ${message}`);
    return { ok: false, message, log };
  }
}
