import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  sanitizeGitErrorMessage,
  validateScmPushBranchName,
} from "@/lib/prototype/platformScmGitSecurity";

const execFileAsync = promisify(execFile);

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
