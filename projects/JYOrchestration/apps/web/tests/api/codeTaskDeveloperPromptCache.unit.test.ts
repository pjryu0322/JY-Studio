import { describe, expect, it } from "vitest";
import {
  buildDeveloperPromptMeta,
  shouldReuseStoredDeveloperPrompt,
} from "@/lib/prototype/codeTaskDeveloperPromptCache";
import {
  CODE_TASK_PROMPT_CONTEXT_VERSION,
  type CodeTaskPromptContextV1,
} from "@/lib/prototype/codeTaskPromptContext";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

const NOW = "2026-06-04T00:00:00.000Z";
const REPO = "pjryu0322/aiprogect";

function runWithPrompt(prompt: string, meta?: unknown): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: "run-1",
    projectId: "p1",
    processTaskId: "DEV-1",
    workItemId: "wi-1",
    codeTaskId: "CT-1",
    status: "prompt_ready",
    attemptNo: 1,
    developerPrompt: prompt,
    developerPromptMeta: meta,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function sampleContext(updatedAt: string): CodeTaskPromptContextV1 {
  return {
    version: CODE_TASK_PROMPT_CONTEXT_VERSION,
    projectId: "p1",
    codeTaskId: "CT-1",
    parentTaskId: "DEV-1",
    createdAt: NOW,
    updatedAt,
    source: "planning_artifacts",
    planningContext: { targetUsers: [] },
    flowContext: { relatedActors: [], relatedUserFlows: [], relatedServiceSteps: [] },
    featureContext: {
      relatedFeatures: [],
      relatedScreens: [],
      relatedStates: [],
      inputs: [],
      outputs: [],
    },
    implementationContext: {
      intent: "구현",
      requirements: ["요구"],
      constraints: [],
      expectedBehavior: [],
      edgeCases: [],
    },
    verificationContext: {
      acceptanceCriteria: ["완료"],
      manualChecks: [],
      regressionChecks: [],
    },
    quality: { ready: true, missing: [], warnings: [] },
  };
}

describe("shouldReuseStoredDeveloperPrompt", () => {
  it("reuses when meta matches repo, branch, paths, and context is not newer", () => {
    const safePrompt = [
      "## 작업 저장소",
      `target repo: ${REPO}`,
      "work branch: `jy/code-task/CT-1`",
      "## 구현 요구사항",
      "- a",
      "- b",
      "- c",
      "## 검증 기준",
      "- pnpm test",
      "## 금지사항",
      "- no platform paths",
    ].join("\n");
    const meta = buildDeveloperPromptMeta({
      promptContext: sampleContext("2026-06-01T00:00:00.000Z"),
      targetRepoFullName: REPO,
      baseBranch: "main",
      allowedPathGlobs: ["apps/web/**"],
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const run = runWithPrompt(safePrompt, meta);
    expect(
      shouldReuseStoredDeveloperPrompt({
        run,
        promptContext: sampleContext("2026-06-01T00:00:00.000Z"),
        targetRepoFullName: REPO,
        baseBranch: "main",
        allowedPathGlobs: ["apps/web/**"],
      }),
    ).toBe(true);
  });

  it("regenerates when promptContext updatedAt is newer than stored meta", () => {
    const safePrompt = [
      "## 작업 저장소",
      `target repo: ${REPO}`,
      "work branch: `jy/code-task/CT-1`",
      "## 구현 요구사항",
      "- a",
      "- b",
      "- c",
      "## 검증 기준",
      "- pnpm test",
      "## 금지사항",
      "- no platform paths",
    ].join("\n");
    const meta = buildDeveloperPromptMeta({
      promptContext: sampleContext("2026-06-01T00:00:00.000Z"),
      targetRepoFullName: REPO,
      baseBranch: "main",
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const run = runWithPrompt(safePrompt, meta);
    expect(
      shouldReuseStoredDeveloperPrompt({
        run,
        promptContext: sampleContext("2026-06-05T00:00:00.000Z"),
        targetRepoFullName: REPO,
        baseBranch: "main",
      }),
    ).toBe(false);
  });

  it("does not reuse unsafe stored prompts", () => {
    const run = runWithPrompt("edit projects/JYOrchestration/apps/web/foo.ts", {
      targetRepoFullName: REPO,
      baseBranch: "main",
      generatedAt: NOW,
    });
    expect(
      shouldReuseStoredDeveloperPrompt({
        run,
        targetRepoFullName: REPO,
        baseBranch: "main",
      }),
    ).toBe(false);
  });
});
