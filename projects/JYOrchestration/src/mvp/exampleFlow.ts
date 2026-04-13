/**
 * MVP — minimal in-memory demonstration of Task → Prompt → Result → Review
 * (and optional full execution run). No external I/O.
 */

import { mvpResetExecutionState, startRun, type ExecutionRun } from "./execution/executionService";
import { clearPromptCache, generatePrompt } from "./prompt/promptService";
import { mvpClearReviewPolicy, reviewTaskResult, type ReviewResult } from "./reviewer/reviewerService";
import { mvpClearTaskStore, mvpSeedProjectTasks, type Task } from "./task/taskService";

export type MvpLinearFlowSnapshot = {
  tasks: Task[];
  prompt: string;
  mockResult: { summary: string; changedFiles: string[]; gitDiffSummary: string };
  review: ReviewResult;
};

function twoTaskFixture(projectId: string): Task[] {
  return [
    {
      id: "task-a",
      title: "Add login form",
      description: "Collect email + password with validation.",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 0,
    },
    {
      id: "task-b",
      title: "Wire API client",
      description: "POST /session with typed errors.",
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: 1,
    },
  ];
}

/**
 * Seeds two FUNCTIONAL/CONFIRMED tasks, builds a prompt for the first,
 * runs simulated review on a non-empty result payload.
 */
export async function mvpExampleLinearFlow(projectId = "mvp-example"): Promise<MvpLinearFlowSnapshot> {
  mvpClearTaskStore();
  clearPromptCache();
  mvpClearReviewPolicy();

  const tasks = twoTaskFixture(projectId);
  mvpSeedProjectTasks(projectId, tasks);

  const prompt = await generatePrompt("task-a");
  const mockResult = {
    summary: "cursor stub ok",
    changedFiles: ["src/auth/LoginForm.tsx"],
    gitDiffSummary: "diff --git a/src/auth/LoginForm.tsx",
  };
  const review = await reviewTaskResult({
    taskId: "task-a",
    prompt,
    result: mockResult,
  });

  return { tasks, prompt, mockResult, review };
}

/**
 * Resets MVP stores, seeds the two-task fixture, runs the full in-memory execution engine
 * (cursor/git stubs + sequential tasks).
 */
export async function mvpExampleFullRun(projectId = "mvp-example-full"): Promise<{
  snapshot: MvpLinearFlowSnapshot;
  run: ExecutionRun;
}> {
  mvpResetExecutionState();
  mvpClearTaskStore();
  clearPromptCache();
  mvpClearReviewPolicy();

  const tasks = twoTaskFixture(projectId);
  mvpSeedProjectTasks(projectId, tasks);

  const prompt = await generatePrompt("task-a");
  const mockResult = {
    summary: "cursor stub ok",
    changedFiles: ["src/auth/LoginForm.tsx"],
    gitDiffSummary: "diff --git a/src/auth/LoginForm.tsx",
  };
  const review = await reviewTaskResult({
    taskId: "task-a",
    prompt,
    result: mockResult,
  });
  const snapshot: MvpLinearFlowSnapshot = { tasks, prompt, mockResult, review };

  const run = await startRun(projectId);
  return { snapshot, run };
}
