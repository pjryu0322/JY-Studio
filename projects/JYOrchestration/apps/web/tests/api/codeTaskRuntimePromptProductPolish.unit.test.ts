import { describe, expect, it } from "vitest";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import {
  validateRuntimeCursorPromptProductQuality,
  validateCodeTaskDeveloperPromptSafety,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import {
  refineTargetUsersForRuntime,
  APP_SHELL_RUNTIME_REQUIREMENTS,
} from "@/lib/prototype/codeTaskRuntimePromptContextView";
import { GENERATED_PROJECT_PROBE_PATHS } from "@/lib/prototype/codeTaskPromptPathPolicy";
import { resolveCodeTaskPromptDraftForCopy } from "@/lib/prototype/resolveCodeTaskPromptDraftForCopy";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";

const REPO = {
  owner: "o",
  repo: "r",
  defaultBranch: "main",
  repoFullName: "o/r",
} as const;

const DEFAULT_USER =
  "회의 녹취를 업로드하고 회의록 초안·요약·스크립트를 확인하는 사용자";

function sampleTask(overrides: Partial<ImplementationCodeTaskV1> = {}): ImplementationCodeTaskV1 {
  return {
    codeTaskId: "CODE-SHELL-001",
    parentTaskId: "DEV-FRAME-001",
    title: "앱 Shell · 화면 프레임 구현",
    description: "공통 화면 프레임",
    changeType: "screen",
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: ["src/components", "src/app"],
    candidateFileHints: [],
    ...overrides,
  };
}

describe("P3-M24 runtime prompt product polish", () => {
  it("refines weak target users to product fallback", () => {
    expect(
      refineTargetUsersForRuntime({ targetUsers: ["참여자"], relatedScreens: [] }),
    ).toEqual([DEFAULT_USER]);
    expect(
      refineTargetUsersForRuntime({
        targetUsers: ["워크스페이스", "회의 목록", "참여자"],
        relatedScreens: [],
      }),
    ).toEqual([DEFAULT_USER]);
    expect(
      refineTargetUsersForRuntime({ targetUsers: ["회의록 작성자"], relatedScreens: [] }),
    ).toEqual(["회의록 작성자"]);
  });

  it("emits wide probe paths when candidates are narrow", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: sampleTask(),
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    for (const glob of GENERATED_PROJECT_PROBE_PATHS) {
      expect(built.prompt).toContain(glob);
    }
    expect(built.prompt).not.toMatch(/^- src\/components$/m);
    expect(built.prompt).not.toMatch(/^- src\/app$/m);
  });

  it("fails product quality when multiple headings or work branches", () => {
    const id = "CODE-A-001";
    const branch = buildCodeTaskWorkBranch(id);
    const bad = [
      "# CodeTask 개발 요청",
      "",
      `- work branch: \`${branch}\``,
      "",
      "# CodeTask 개발 요청",
      "",
      `- work branch: \`${branch}-other\``,
    ].join("\n");
    const result = validateRuntimeCursorPromptProductQuality({
      prompt: bad,
      codeTaskId: id,
      workBranch: branch,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("multiple_runtime_prompt_headings");
    expect(result.errors).toContain("multiple_work_branches");
  });

  it("app shell prompt uses concrete shell requirements without loading templates", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: sampleTask(),
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(built.prompt).toContain("반응형 3열 workspace shell/container");
    expect(built.prompt).toContain("좌열/중앙/우열");
    expect(built.prompt).toMatch(/모바일.*세로 스택|탭 구조/);
    expect(built.prompt).not.toMatch(/LoadingState|Spinner|Skeleton/);
    expect(APP_SHELL_RUNTIME_REQUIREMENTS.length).toBeGreaterThanOrEqual(5);
  });

  it("blocks app shell runtime prompt with loading template leak", () => {
    const id = "CODE-SHELL-001";
    const branch = buildCodeTaskWorkBranch(id);
    const prompt = [
      "# CodeTask 개발 요청",
      "## 작업 저장소",
      `- 작업 대상 저장소: \`${REPO.repoFullName}\``,
      `- work branch: \`${branch}\``,
      "## 구현 요구사항",
      "- a",
      "- b",
      "- c",
      "## 수정 대상 탐색 기준",
      "- 우선 탐색 경로:",
      ...GENERATED_PROJECT_PROBE_PATHS.map((p) => `- ${p}`),
      "## 검증 기준",
      "- v1",
      "- v2",
      "## 금지사항",
      "- x",
      `CodeTask: ${id}`,
      "LoadingState",
    ].join("\n");
    const result = validateRuntimeCursorPromptProductQuality({
      prompt,
      codeTaskId: id,
      workBranch: branch,
      roleKind: "app_shell",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("app_shell_contains_loading_component_template");
  });

  it("allows planning draft bundle with multiple code tasks", () => {
    const taskList: ImplementationTaskListV1 = {
      version: 1,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed_v1",
      tasks: [
        {
          taskId: "DEV-1",
          title: "로그인",
          description: "로그인",
          taskType: "screen",
          ownerRole: "developer",
          priority: "high",
          status: "ready",
          dependencies: [],
          acceptanceCriteria: ["로그인"],
          sourceRefs: [],
        },
        {
          taskId: "DEV-2",
          title: "재시도",
          description: "재시도",
          taskType: "common",
          ownerRole: "developer",
          priority: "medium",
          status: "ready",
          dependencies: [],
          acceptanceCriteria: ["재시도"],
          sourceRefs: [],
        },
      ],
      roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const result = resolveCodeTaskPromptDraftForCopy({
      projectId: "p1",
      codeTaskPlan: plan,
      taskList,
      codeTaskPromptContextMapV1: null,
      mode: "all",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.prompt) {
      expect(result.prompt.split("CodeTask:").length).toBeGreaterThan(2);
      expect(result.prompt).not.toContain("work branch:");
    }
  });

  it("integrated safety requires codeTaskId context for product gate", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: sampleTask({ codeTaskId: "CODE-DEV-COMMON-004-001", title: "재시도 공통 기능 구현" }),
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    const id = "CODE-DEV-COMMON-004-001";
    expect(
      validateCodeTaskDeveloperPromptSafety({
        prompt: built.prompt,
        targetRepoFullName: REPO.repoFullName,
        targetRepoKind: "generated_project",
        codeTaskId: id,
        workBranch: buildCodeTaskWorkBranch(id),
        roleKind: "common_retry",
      }).ok,
    ).toBe(true);
  });
});
