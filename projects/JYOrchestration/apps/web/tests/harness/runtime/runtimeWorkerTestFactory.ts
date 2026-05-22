/**
 * Minimal Runtime Worker E2E test fixtures.
 */

import type { ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";

export const RUNTIME_E2E_PROJECT_ID = "proj-runtime-e2e";
export const RUNTIME_E2E_TASK_ID = "task-runtime-e2e";
export const RUNTIME_E2E_EXEC_RUN_ID = "run-runtime-e2e";
export const RUNTIME_E2E_ACTOR_ID = "user-runtime-e2e";

export function mockCursorSuccessOutcome(): ExecuteCursorRunOutcome {
  return {
    ok: true,
    result: {
      runId: "cursor-run-1",
      summary: "ok",
      changedFiles: ["src/a.ts"],
      branchName: "orch/task-1",
      commitHash: "abc123",
    },
    logs: [],
  };
}

export function mockExecutionSetup() {
  return {
    gitRepoUrl: "https://github.com/org/repo",
    baseBranch: "main",
    githubAccessToken: null,
    cursorApiUrl: "https://api.cursor.com",
    cursorApiToken: "token",
    branchStrategy: "per_task",
    branchPrefix: "orch",
    autoCommit: true,
    autoPush: true,
    autoPr: false,
    requireTestsBeforePush: false,
    requireApprovalBeforeApply: false,
  };
}
