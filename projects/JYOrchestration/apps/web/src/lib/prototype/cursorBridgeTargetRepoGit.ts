import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";

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

export function targetRepositoryWorkdirPath(
  cloneRoot: string,
  targetRepository: ProjectTargetRepository,
): string {
  return path.join(cloneRoot, `${targetRepository.owner}-${targetRepository.repo}`);
}

export async function ensureTargetRepositoryWorktree(input: {
  readonly cloneRoot: string;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly workBranch: string;
}): Promise<Readonly<{ readonly workdir: string; readonly log: readonly string[] }>> {
  const log: string[] = [];
  const workdir = targetRepositoryWorkdirPath(input.cloneRoot, input.targetRepository);
  const cloneUrl = input.targetRepository.cloneUrl ?? `https://github.com/${input.targetRepository.repoFullName}.git`;

  let exists = false;
  try {
    await access(path.join(workdir, ".git"));
    exists = true;
  } catch {
    exists = false;
  }

  if (!exists) {
    await execFileAsync("git", ["clone", cloneUrl, workdir], {
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    });
    log.push(`[GIT] cloned ${input.targetRepository.repoFullName}`);
  } else {
    log.push(`[GIT] reuse worktree ${workdir}`);
    await git(workdir, ["fetch", "origin"]);
  }

  const baseBranch = input.baseBranch.trim() || input.targetRepository.defaultBranch || "main";
  await git(workdir, ["checkout", baseBranch]);
  log.push(`[GIT] checkout ${baseBranch}`);
  try {
    await git(workdir, ["pull", "--ff-only", "origin", baseBranch]);
    log.push(`[GIT] pull ${baseBranch}`);
  } catch (e) {
    log.push(`[GIT] pull skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
  await git(workdir, ["checkout", "-B", input.workBranch]);
  log.push(`[GIT] checkout -B ${input.workBranch}`);

  return { workdir, log };
}

export async function prepareExecutionSetupWorkspace(input: {
  readonly workdir: string;
  readonly baseBranch: string;
  readonly workBranch: string;
}): Promise<Readonly<{ readonly log: readonly string[] }>> {
  const log: string[] = [];
  const baseBranch = input.baseBranch.trim() || "main";
  await git(input.workdir, ["rev-parse", "--is-inside-work-tree"]);
  log.push(`[GIT] workspace ${input.workdir}`);
  await git(input.workdir, ["checkout", baseBranch]);
  log.push(`[GIT] checkout ${baseBranch}`);
  try {
    await git(input.workdir, ["pull", "--ff-only", "origin", baseBranch]);
    log.push(`[GIT] pull ${baseBranch}`);
  } catch (e) {
    log.push(`[GIT] pull skipped: ${e instanceof Error ? e.message : String(e)}`);
  }
  await git(input.workdir, ["checkout", "-B", input.workBranch]);
  log.push(`[GIT] checkout -B ${input.workBranch}`);
  return { log };
}
