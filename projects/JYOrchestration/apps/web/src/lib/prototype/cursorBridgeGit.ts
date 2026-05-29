import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CommitWorktreeChangesResult = Readonly<{
  readonly commitSha: string | null;
  readonly changedFiles: readonly string[];
  readonly pushed: boolean;
  readonly pushError?: string;
  readonly log: readonly string[];
}>;

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

export async function listWorktreeChangedFiles(workdir: string): Promise<readonly string[]> {
  const { stdout } = await git(workdir, ["status", "--porcelain"]);
  if (!stdout) return [];
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

export async function commitWorktreeChanges(input: {
  readonly workdir: string;
  readonly branchName: string;
  readonly commitMessage: string;
  readonly requestedPush: boolean;
  readonly pushEnabledEnv?: boolean;
}): Promise<CommitWorktreeChangesResult> {
  const log: string[] = [];
  const pushAllowed = input.pushEnabledEnv === true && input.requestedPush;

  try {
    await git(input.workdir, ["rev-parse", "--is-inside-work-tree"]);
    log.push("[GIT] worktree OK");
    await git(input.workdir, ["checkout", "-B", input.branchName]);
    log.push(`[GIT] checkout -B ${input.branchName}`);

    const changedBefore = await listWorktreeChangedFiles(input.workdir);
    if (!changedBefore.length) {
      log.push("[GIT] no changes to commit");
      return { commitSha: null, changedFiles: [], pushed: false, log };
    }

    await git(input.workdir, ["add", "-A"]);
    await git(input.workdir, ["commit", "-m", input.commitMessage]);
    log.push("[GIT] commit OK");

    const sha = (await git(input.workdir, ["rev-parse", "HEAD"])).stdout;
    const changedFiles = await listWorktreeChangedFiles(input.workdir);
    const files = changedBefore.length ? changedBefore : changedFiles;

    let pushed = false;
    let pushError: string | undefined;
    if (pushAllowed) {
      try {
        await git(input.workdir, ["push", "-u", "origin", input.branchName]);
        pushed = true;
        log.push("[GIT] push OK");
      } catch (e) {
        pushError = e instanceof Error ? e.message : String(e);
        log.push(`[GIT] push failed: ${pushError}`);
      }
    } else {
      log.push("[GIT] push skipped");
    }

    return {
      commitSha: sha || null,
      changedFiles: files,
      pushed,
      ...(pushError ? { pushError } : {}),
      log,
    };
  } catch (e) {
    log.push(`[GIT][ERROR] ${e instanceof Error ? e.message : String(e)}`);
    return { commitSha: null, changedFiles: [], pushed: false, log };
  }
}
