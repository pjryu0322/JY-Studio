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
  /** ENV_TEST 계열: 최소 Hello World 변경만 요청해 토큰·지연을 줄인다. */
  compactHelloWorld?: boolean;
  /** 기본 연결 테스트는 orchestration-test 트리, 역할 분리 경로는 hello-world.md 단일 파일(머지 규칙과 정합). */
  envTestCompactVariant?: "stage1" | "stage2";
  /** 지식팩 RAG 기반 컨텍스트(비어 있으면 삽입하지 않음). 최대 6000자로 잘라 넣는다. */
  knowledgePackContextText?: string;
};

const ENV_TEST_COMPACT_PROMPT_MAX_CHARS = 800;
const KNOWLEDGE_PACK_CONTEXT_MAX_CHARS = 6000;

function clampKnowledgePackContextBlock(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.length <= KNOWLEDGE_PACK_CONTEXT_MAX_CHARS) return t;
  return `${t.slice(0, KNOWLEDGE_PACK_CONTEXT_MAX_CHARS - 20)}\n…(truncated)`;
}

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
    const variant = opts.envTestCompactVariant ?? "stage1";
    if (variant === "stage1") {
      const compact = [
        `You are executing a minimal ENV_TEST Hello World smoke task.`,
        ``,
        `Repository: ${setup.gitRepoUrl}`,
        `Base branch: ${setup.baseBranch}`,
        `Working branch: ${setup.suggestedBranchName}`,
        ``,
        `Make a small change only under this path prefix:`,
        `orchestration-test/**`,
        ``,
        `Prefer a single small text file with a short line such as "Hello World".`,
        `Your work should result in at least one commit on the working branch.`,
        ``,
        `After the edit, commit and push the branch to origin.`,
        ``,
        `Do not create a pull request.`,
        `Do not modify files outside orchestration-test/**.`,
      ].join("\n");
      if (compact.length <= ENV_TEST_COMPACT_PROMPT_MAX_CHARS) return compact;
      const compactFallback = [
        `ENV_TEST Hello World smoke.`,
        `Repo ${setup.gitRepoUrl} | Base ${setup.baseBranch} | Branch ${setup.suggestedBranchName}`,
        `Change only under orchestration-test/** (e.g. one small text file, Hello World line).`,
        `Commit and push. No PR.`,
      ].join("\n");
      if (compactFallback.length <= ENV_TEST_COMPACT_PROMPT_MAX_CHARS) return compactFallback;
      return compactFallback.slice(0, ENV_TEST_COMPACT_PROMPT_MAX_CHARS);
    }

    const compact = [
      `You are executing a minimal ENV_TEST (role-separation path) task.`,
      ``,
      `Repository: ${setup.gitRepoUrl}`,
      `Base branch: ${setup.baseBranch}`,
      `Working branch: ${setup.suggestedBranchName}`,
      ``,
      `Change exactly one Markdown file at:`,
      `orchestration-test/hello-world.md`,
      ``,
      `Keep the document small (for example a short heading and one line of body text).`,
      ``,
      `Do not add or modify any other paths. At least one commit on the working branch.`,
      ``,
      `Commit and push the branch to origin.`,
      ``,
      `Do not create a pull request.`,
    ].join("\n");
    if (compact.length <= ENV_TEST_COMPACT_PROMPT_MAX_CHARS) return compact;

      const compactFallback = [
        `ENV_TEST role-separation path.`,
      `Repo ${setup.gitRepoUrl} | Base ${setup.baseBranch} | Branch ${setup.suggestedBranchName}`,
      `Only orchestration-test/hello-world.md (small Markdown).`,
      `Commit and push. No PR.`,
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

  const kpRaw = opts?.knowledgePackContextText;
  const kpClamped = clampKnowledgePackContextBlock(kpRaw ?? "");
  const kpBlock = kpClamped
    ? `

## Knowledge Pack Context

${kpClamped}

`
    : "";

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
${kpBlock}
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
