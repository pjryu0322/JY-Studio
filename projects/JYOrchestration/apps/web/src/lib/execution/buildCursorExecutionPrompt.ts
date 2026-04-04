export type CursorPromptTask = {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string[];
};

export type CursorPromptProject = {
  id: string;
  name: string;
};

export type RelayPromptSetup = {
  gitRepoUrl: string;
  baseBranch: string;
  branchStrategy: string;
  suggestedBranchName: string;
  autoCommit: boolean;
  autoPush: boolean;
  requireTestsBeforePush: boolean;
  allowedPathGlobs: string[];
};

const DEFAULT_ALLOWED = ["src/**", "app/**", "tests/**", "packages/**", "lib/**", "components/**"];

export type BuildCursorExecutionPromptOptions = {
  /** ENV_TEST_STAGE2: Stage 1과 동일한 최소 작업만 요청해 토큰·지연을 줄인다. */
  compactHelloWorld?: boolean;
};

/**
 * Cursor Background Agent용 프롬프트. 로컬 경로 없음 — 원격 저장소 URL만 전달한다.
 */
export function buildCursorExecutionPrompt(
  task: CursorPromptTask,
  project: CursorPromptProject,
  setup: RelayPromptSetup,
  opts?: BuildCursorExecutionPromptOptions
): string {
  if (opts?.compactHelloWorld) {
    const commitHint = setup.autoCommit ? "One commit." : "Commit if needed.";
    const pushHint = setup.autoPush ? "Push branch to origin." : "Do not push.";
    return [
      `ENV_TEST Stage2 smoke. Repo ${setup.gitRepoUrl}`,
      `Base ${setup.baseBranch} | use branch name exactly: ${setup.suggestedBranchName}`,
      `Create ONE file only: orchestration-test/hello-world.md`,
      `Body (markdown):`,
      `# Hello`,
      `smoke`,
      `${commitHint} ${pushHint}`,
      `No other files. No PR. Report branchName + commitHash when done.`,
    ].join("\n");
  }

  const criteria = task.acceptanceCriteria.length
    ? task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "(No explicit acceptance criteria — implement from title and description.)";

  const allowed =
    setup.allowedPathGlobs.length > 0
      ? setup.allowedPathGlobs.map((g) => `- ${g}`).join("\n")
      : DEFAULT_ALLOWED.map((g) => `- ${g}`).join("\n");

  const testHint = setup.requireTestsBeforePush
    ? "Run tests/build before push when policy requires it; report failures clearly in your summary."
    : "Run quick relevant tests when practical; mention failures in summary.";

  const commitHint = setup.autoCommit
    ? "Create a commit with a clear message (e.g. feat(task:<id>): …) when changes are ready."
    : "Do not commit unless you must for intermediate saves; prefer a single commit when done.";
  const pushHint = setup.autoPush
    ? "Push your branch to origin when work is complete and validated per policy."
    : "Do not push unless explicitly required; leave branch local if policy disables push.";

  return `You are the **execution engine** (e.g. Cursor Background Agent) for an orchestration platform.
The platform does **not** clone repos, run git, or modify files — **you** own clone, branch, commit, and push to GitHub.

## Repository (only this URL — no cross-repo)
- Remote: ${setup.gitRepoUrl}
- Base branch (integration): ${setup.baseBranch}
- Branch strategy (from orchestrator): ${setup.branchStrategy}
- **Use this working branch name** (create from base if needed): ${setup.suggestedBranchName}

## Scope
- Clone or use a clean worktree for the URL above only.
- Prefer changes under:
${allowed}
- Keep edits minimal and task-scoped. Do not touch unrelated repos or paths.

## Project (orchestration metadata)
- Orchestration project id: ${project.id}
- Name: ${project.name}

## Task
- Task id: ${task.id}
- Title: ${task.title}

## Description
${task.description?.trim() || "(none)"}

## Acceptance criteria (must satisfy)
${criteria}

## Git / delivery policy (from orchestrator)
- ${commitHint}
- ${pushHint}
- ${testHint}

## Reporting back to orchestrator
Return structured result to the HTTP API: runId, summary, changedFiles[], branchName, commitHash (after commit).

## Summary for humans
End with a concise list of files changed and what was implemented.
`.trim();
}
