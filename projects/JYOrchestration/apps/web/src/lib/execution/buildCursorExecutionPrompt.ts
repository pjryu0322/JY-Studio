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
  /** ENV_TEST family(Stage 1/2): 최소 Hello World 변경만 요청해 토큰·지연을 줄인다. */
  compactHelloWorld?: boolean;
};

const ENV_TEST_COMPACT_PROMPT_MAX_CHARS = 800;

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
    const compact = [
      `You are executing a minimal ENV_TEST task.`,
      ``,
      `Repository: ${setup.gitRepoUrl}`,
      `Base branch: ${setup.baseBranch}`,
      `Working branch: ${setup.suggestedBranchName}`,
      ``,
      `Make a small change under:`,
      `orchestration-test/**`,
      ``,
      `Your work must result in at least one commit on the working branch.`,
      ``,
      `A simple approach is to create or update a small text file with a short "Hello World" line.`,
      ``,
      `After making the change, commit it and push the branch to origin.`,
      ``,
      `Do not create a pull request.`,
      `Do not modify files outside orchestration-test/**.`,
    ].join("\n");
    if (compact.length <= ENV_TEST_COMPACT_PROMPT_MAX_CHARS) return compact;

    const compactFallback = [
      `Minimal ENV_TEST task.`,
      `Repo ${setup.gitRepoUrl}`,
      `Base ${setup.baseBranch} | Branch ${setup.suggestedBranchName}`,
      `Change only orchestration-test/**.`,
      `Create/update one small text file and produce at least one commit.`,
      `Commit and push branch to origin.`,
      `No PR. No changes outside orchestration-test/**.`,
    ].join("\n");
    if (compactFallback.length <= ENV_TEST_COMPACT_PROMPT_MAX_CHARS) return compactFallback;
    return compactFallback.slice(0, ENV_TEST_COMPACT_PROMPT_MAX_CHARS);
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
