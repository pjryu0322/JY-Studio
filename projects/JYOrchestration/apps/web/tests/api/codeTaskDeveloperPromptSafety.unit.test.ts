import { describe, expect, it } from "vitest";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import {
  CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { resolveCodeTaskFeaturePromptTemplate } from "@/lib/prototype/codeTaskPromptFeatureTemplates";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildFileBoundaryForRole } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  CODE_TASK_PROMPT_CONTEXT_VERSION,
  type CodeTaskPromptContextV1,
} from "@/lib/prototype/codeTaskPromptContext";

const NOW = "2026-06-04T00:00:00.000Z";
const REPO = {
  owner: "pjryu0322",
  repo: "aiprogect",
  defaultBranch: "main",
  repoFullName: "pjryu0322/aiprogect",
} as const;

function sampleCodeTask(overrides: Partial<ImplementationCodeTaskV1> = {}): ImplementationCodeTaskV1 {
  return {
    codeTaskId: "CODE-DEV-COMMON-004-001",
    parentTaskId: "DEV-COMMON-004",
    title: "재시도 공통 기능 구현 · 기능 구현",
    description: "공통 상세기능 요구에 따라 재시도을 구현합니다.",
    changeType: "component",
    acceptanceCriteria: ["재시도"],
    verificationHints: ["cd projects/JYOrchestration/apps/web", "pnpm test"],
    forbiddenPaths: ["projects/JYOrchestration/**"],
    candidateFiles: ["projects/JYOrchestration/apps/web/foo.ts"],
    candidateFileHints: [],
    ...overrides,
  };
}

function buildPrompt(task: ImplementationCodeTaskV1) {
  return buildCodeTaskDeveloperPromptDetailed({
    codeTask: task,
    targetRepository: REPO,
    baseBranch: "main",
    targetRepoKind: "generated_project",
  });
}

function expectNoPlatformLeakage(prompt: string) {
  expect(prompt).not.toMatch(/JYOrchestration/i);
  expect(prompt).not.toContain("projects/JYOrchestration");
  expect(prompt).not.toContain("cd projects/JYOrchestration");
  expect(prompt).not.toContain("Stage1/Stage2/ENV_TEST");
  expect(prompt).not.toContain("JYGallery");
}

describe("validateCodeTaskDeveloperPromptSafety", () => {
  it("fails when platform strings appear anywhere in generated prompt", () => {
    const result = validateCodeTaskDeveloperPromptSafety({
      prompt: "fix projects/JYOrchestration/apps/web/foo.ts",
      targetRepoFullName: REPO.repoFullName,
      targetRepoKind: "generated_project",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.startsWith("banned_snippet"))).toBe(true);
  });
});

describe("resolveCodeTaskFeaturePromptTemplate", () => {
  it("selects retry template for retry tasks", () => {
    const t = resolveCodeTaskFeaturePromptTemplate({
      title: "재시도 공통 기능 구현",
      description: "재시도",
      requirements: ["재시도"],
      changeType: "component",
    });
    expect(t.kind).toBe("retry");
    expect(t.implementationRequirements.join(" ")).toContain("onRetry");
  });
});

function samplePromptContext(): CodeTaskPromptContextV1 {
  return {
    version: CODE_TASK_PROMPT_CONTEXT_VERSION,
    projectId: "p1",
    codeTaskId: "CODE-DEV-COMMON-004-001",
    parentTaskId: "DEV-COMMON-004",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_artifacts",
    planningContext: {
      serviceGoal: "운영 KPI 대시보드",
      problemToSolve: "데이터 조회 지연",
      targetUsers: ["운영자"],
    },
    flowContext: { relatedActors: ["운영자"], relatedUserFlows: ["로그인"], relatedServiceSteps: [] },
    featureContext: {
      relatedFeatures: ["재시도"],
      relatedScreens: [],
      relatedStates: [],
      inputs: [],
      outputs: [],
    },
    implementationContext: {
      intent: "재시도 UX",
      requirements: ["중복 클릭 방지"],
      constraints: [],
      expectedBehavior: [],
      edgeCases: [],
    },
    verificationContext: {
      acceptanceCriteria: ["재시도"],
      manualChecks: [],
      regressionChecks: [],
    },
    quality: { ready: true, missing: [], warnings: [] },
  };
}

describe("buildCodeTaskDeveloperPromptDetailed generated_project", () => {
  it("includes planning context sections when promptContext is provided", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: sampleCodeTask(),
      promptContext: samplePromptContext(),
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(built.prompt).toContain("## 기획 맥락");
    expect(built.prompt).toContain("## 이번 CodeTask의 역할");
    expect(built.prompt).toContain("운영 KPI 대시보드");
    expectNoPlatformLeakage(built.prompt);
  });

  it("builds retry sample without platform leakage", () => {
    const built = buildPrompt(sampleCodeTask());
    expect(built.prompt).toContain("pjryu0322/aiprogect");
    expect(built.prompt).toContain(buildCodeTaskWorkBranch("CODE-DEV-COMMON-004-001"));
    expect(built.prompt).toContain("RetryButton");
    expect(built.prompt).toContain("onRetry handler");
    expect(built.prompt).toContain("## 작업 저장소");
    expect(built.prompt).toContain("## 검증 기준");
    expect(built.prompt).not.toContain("## 허용 경로");
    expectNoPlatformLeakage(built.prompt);
    expect(
      validateCodeTaskDeveloperPromptSafety({
        prompt: built.prompt,
        targetRepoFullName: REPO.repoFullName,
        targetRepoKind: "generated_project",
      }).ok,
    ).toBe(true);
  });

  it("builds error message template", () => {
    const built = buildPrompt(
      sampleCodeTask({
        codeTaskId: "CODE-ERR-001",
        title: "오류 메시지 공통 기능 구현",
        description: "오류 UI",
        acceptanceCriteria: ["표시"],
      }),
    );
    expect(built.prompt).toContain("ErrorMessage");
    expect(built.prompt).toContain('role="alert"');
    expectNoPlatformLeakage(built.prompt);
  });

  it("builds loading state template", () => {
    const built = buildPrompt(
      sampleCodeTask({
        title: "로딩 상태 공통 기능 구현",
        description: "loading UI",
        acceptanceCriteria: [],
      }),
    );
    expect(built.prompt).toMatch(/LoadingState|Spinner|Skeleton/);
    expect(built.prompt).toContain("aria-busy");
    expectNoPlatformLeakage(built.prompt);
  });

  it("builds empty state template", () => {
    const built = buildPrompt(
      sampleCodeTask({
        title: "빈 결과 안내 구현",
        description: "empty state",
        acceptanceCriteria: [],
      }),
    );
    expect(built.prompt).toContain("EmptyState");
    expectNoPlatformLeakage(built.prompt);
  });
});

describe("resolveCodeTaskDeveloperPromptForCopy", () => {
  const plan: ImplementationCodeTaskPlanV1 = {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      sampleCodeTask({
        codeTaskId: "CT-1",
        parentTaskId: "DEV-1",
        title: "화면",
        verificationHints: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "feature",
          workBranch: "wip/feature/core-flow",
          baseBranch: "wip/common/components",
          baseBranchPolicy: "previous_group",
          executionMode: "sequential",
        },
        fileBoundary: buildFileBoundaryForRole("feature_start", {
          codeTaskId: "CT-1",
          title: "화면",
        }),
      }),
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
    const contextMap = buildCodeTaskPromptContextMap({
      projectId: "p1",
      codeTaskPlan: plan,
      requirementsStateJson: {},
    });
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
      codeTaskPromptContextMapV1: contextMap,
    });
    expect(result.ok).toBe(true);
    expect(result.prompt).toContain("o/r");
    expect(result.prompt).not.toContain("projects/JYOrchestration");
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
