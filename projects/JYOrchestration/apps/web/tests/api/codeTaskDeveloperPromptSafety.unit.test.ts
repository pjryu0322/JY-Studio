import { describe, expect, it } from "vitest";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

const NOW = "2026-06-04T00:00:00.000Z";

describe("validateCodeTaskDeveloperPromptSafety", () => {
  it("fails when platform paths appear in candidate section", () => {
    const result = validateCodeTaskDeveloperPromptSafety({
      prompt: [
        "## 수정 대상 파일 후보",
        "- projects/JYOrchestration/apps/web/foo.ts",
        "",
        "## 허용 경로",
        "- src/**",
      ].join("\n"),
      targetRepoFullName: "o/r",
      targetRepoKind: "generated_project",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("platform_path"))).toBe(true);
  });
});

describe("buildCodeTaskDeveloperPromptDetailed", () => {
  it("sanitizes platform candidates and includes repo scope", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: {
        codeTaskId: "CODE-DEV-COMMON-002-001",
        parentTaskId: "DEV-1",
        title: "오류 메시지 공통 기능 구현",
        description: "공통 오류 UI",
        changeType: "feature",
        acceptanceCriteria: ["표시"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [
          "projects/JYOrchestration/apps/web/src/lib/prototype/implementationTaskPlan.ts",
        ],
        candidateFileHints: ["dir:projects/JYOrchestration/apps/web/src/lib/prototype"],
      },
      targetRepository: {
        owner: "pjryu0322",
        repo: "aiprogect",
        defaultBranch: "main",
        repoFullName: "pjryu0322/aiprogect",
      },
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(built.prompt).toContain("pjryu0322/aiprogect");
    expect(built.prompt).not.toContain("projects/JYOrchestration/apps/web");
    expect(built.prompt).not.toContain("플랫폼 허용 경로 미지정");
    expect(built.prompt).toContain("## 허용 경로");
    expect(built.prompt).toContain("src/**");
    expect(built.prompt).toContain("대상 저장소 내부");
    expect(built.removedCandidatePaths.length).toBeGreaterThan(0);
    expect(
      validateCodeTaskDeveloperPromptSafety({
        prompt: built.prompt,
        targetRepoFullName: "pjryu0322/aiprogect",
        targetRepoKind: "generated_project",
      }).ok,
    ).toBe(true);
  });
});

describe("resolveCodeTaskDeveloperPromptForCopy", () => {
  const plan: ImplementationCodeTaskPlanV1 = {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CT-1",
        parentTaskId: "DEV-1",
        title: "화면",
        description: "desc",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
    ],
  };

  it("rebuilds when stored prompt contains platform paths", () => {
    const run: CodeTaskExecutionRunV1 = {
      version: "code_task_execution_run_v1",
      runId: "run-1",
      projectId: "p1",
      processTaskId: "DEV-1",
      workItemId: "wi-1",
      codeTaskId: "CT-1",
      status: "prompt_ready",
      attemptNo: 1,
      developerPrompt: "edit projects/JYOrchestration/apps/web/foo.ts",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const result = resolveCodeTaskDeveloperPromptForCopy({
      projectId: "p1",
      codeTaskId: "CT-1",
      codeTaskPlan: plan,
      taskList: null,
      cursorWorkItems: [
        {
          id: "wi-1",
          taskId: "DEV-1",
          codeTaskId: "CT-1",
          title: "wi",
          prompt: "",
          requiredFilesHint: [],
          expectedOutput: [],
          testCommands: [],
          forbiddenPaths: [],
          blocked: false,
          blockers: [],
          qualityGate: { promptReady: true, missing: [], score: 100 },
        },
      ],
      runs: [run],
      targetRepository: {
        owner: "o",
        repo: "r",
        defaultBranch: "main",
        repoFullName: "o/r",
      },
      baseBranch: "main",
    });
    expect(result.ok).toBe(true);
    expect(result.prompt).toContain("o/r");
    expect(result.prompt).not.toContain("projects/JYOrchestration/apps/web");
  });

  it("blocks copy when prompt cannot be made safe", () => {
    const result = resolveCodeTaskDeveloperPromptForCopy({
      projectId: "p1",
      codeTaskId: "missing",
      codeTaskPlan: plan,
      taskList: null,
      cursorWorkItems: [],
      runs: [],
      targetRepository: {
        owner: "o",
        repo: "r",
        defaultBranch: "main",
        repoFullName: "o/r",
      },
      baseBranch: "main",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).not.toBe(CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE);
  });
});
