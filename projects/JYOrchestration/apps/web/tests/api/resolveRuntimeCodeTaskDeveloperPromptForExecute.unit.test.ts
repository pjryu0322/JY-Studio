import { describe, expect, it } from "vitest";
import {
  fingerprintRuntimeDeveloperPrompt,
  resolveRuntimeCodeTaskDeveloperPromptForExecute,
} from "@/lib/prototype/resolveRuntimeCodeTaskDeveloperPromptForExecute";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import { buildUserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import {
  finalizeCodeTaskDeveloperPromptWithAugmentation,
  storedDeveloperPromptMissingAugmentation,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import type { UserProjectKnowledgeMemoryItem } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

const CODE_TASK_ID = "CODE-APP-SHELL-001";
const WORK_BRANCH = buildCodeTaskWorkBranch(CODE_TASK_ID);

function minimalRuntimePrompt(codeTaskId: string, workBranch: string, baseBranch = "main"): string {
  return [
    "# CodeTask 개발 요청",
    "",
    "## 작업 저장소",
    `- 작업 대상 저장소: \`owner/repo\``,
    `- base branch: \`${baseBranch}\``,
    `- work branch: \`${workBranch}\``,
    "",
    "## Branch Plan",
    "",
    `- branch group: \`foundation\``,
    `- work branch: \`${workBranch}\``,
    `- base branch: \`${baseBranch}\``,
    "",
    "## 구현 요구사항",
    "- a",
    "- b",
    "- c",
    "",
    "## 수정 허용 파일",
    "- `src/components/Foo.*`",
    "",
    "## 수정 금지 파일",
    "- `src/forbidden/*`",
    "",
    "## 수정 대상 탐색 기준",
    "- apps/web/src/**/*.tsx",
    "",
    "## 검증 기준",
    "- v1",
    "- v2",
    "",
    "## 금지사항",
    "- none",
    "",
    "## 완료 기준",
    "- done",
    "",
    "## 작업 결과 보고 형식",
    "- 변경 요약: (작업 후 기록)",
    "",
    "requiresIntegrationChange",
    "핵심 사용자: primary end users of the feature",
  ].join("\n");
}

import { assertStageTwoDeveloperPromptAllowed } from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";

describe("resolveRuntimeCodeTaskDeveloperPromptForExecute", () => {
  const targetRepository = {
    repoFullName: "owner/repo",
    defaultBranch: "main",
    provider: "github" as const,
  };

  const requirementsStateJson = {
    implementationCodeTaskPlanV1: {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      tasks: [
        {
          codeTaskId: CODE_TASK_ID,
          parentTaskId: "TASK-1",
          title: "App Shell",
          description: "desc",
          changeType: "component",
          targetHints: [],
          dependencies: [],
          acceptanceCriteria: ["a"],
          verificationHints: [],
          forbiddenPaths: [],
          priority: "P1",
          status: "ready",
          blockers: [],
          branchPlan: {
            branchGroup: "foundation",
            workBranch: WORK_BRANCH,
            baseBranch: "main",
            baseBranchPolicy: "main",
            executionMode: "sequential",
          },
          fileBoundary: {
            version: "code_task_file_boundary_v1",
            fileBoundaryConfidence: "high",
            ownedFiles: ["src/components/Foo.*"],
            forbiddenFiles: ["src/forbidden/*"],
            expectedFiles: ["src/components/Foo.*"],
          },
        },
      ],
    },
    codeTaskPromptContextMapV1: {
      version: "code_task_prompt_context_map_v1",
      projectId: "p1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      contexts: {
        [CODE_TASK_ID]: {
          version: "code_task_prompt_context_v1",
          projectId: "p1",
          codeTaskId: CODE_TASK_ID,
          parentTaskId: "TASK-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          source: "heuristic_fallback",
          planningContext: { targetUsers: ["users"], serviceGoal: "goal" },
          flowContext: { relatedActors: [], relatedUserFlows: [], relatedServiceSteps: [] },
          featureContext: {
            relatedFeatures: [],
            relatedScreens: [],
            relatedStates: [],
            inputs: [],
            outputs: [],
          },
          implementationContext: {
            intent: "intent",
            requirements: ["a", "b", "c"],
            constraints: [],
            expectedBehavior: [],
            edgeCases: [],
          },
          verificationContext: { acceptanceCriteria: ["v1", "v2"], manualChecks: [], regressionChecks: [] },
          quality: { ready: true, missing: [], warnings: [] },
        },
      },
    },
    implementationTaskListV1: {
      version: "implementation_task_list_v1",
      tasks: [
        {
          taskId: "TASK-1",
          title: "Parent",
          description: "",
          type: "feature",
          priority: "P1",
          status: "ready",
        },
      ],
    },
  };

  it("minimalRuntimePrompt fixture passes stage-two gate", () => {
    const prompt = minimalRuntimePrompt(CODE_TASK_ID, WORK_BRANCH);
    expect(assertStageTwoDeveloperPromptAllowed({ prompt }).ok).toBe(true);
  });

  it("uses request body developerPrompt when provided", () => {
    const prompt = minimalRuntimePrompt(CODE_TASK_ID, WORK_BRANCH);
    const resolved = resolveRuntimeCodeTaskDeveloperPromptForExecute({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      taskId: "TASK-1",
      developerPrompt: prompt,
      developerPromptFingerprint: fingerprintRuntimeDeveloperPrompt(prompt),
      requirementsStateJson,
      targetRepository,
      baseBranch: "main",
      workBranch: WORK_BRANCH,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.promptSource).toBe("request_body");
    expect(resolved.prompt).toBe(prompt);
    expect(resolved.fingerprint).toBe(fingerprintRuntimeDeveloperPrompt(prompt));
  });

  it("blocks fingerprint mismatch", () => {
    const prompt = minimalRuntimePrompt(CODE_TASK_ID, WORK_BRANCH);
    const resolved = resolveRuntimeCodeTaskDeveloperPromptForExecute({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      taskId: "TASK-1",
      developerPrompt: prompt,
      developerPromptFingerprint: "deadbeef",
      requirementsStateJson,
      targetRepository,
      baseBranch: "main",
    });
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.reason).toBe("prompt_source_mismatch");
  });

  it("blocks work branch mismatch in prompt", () => {
    const prompt = minimalRuntimePrompt(CODE_TASK_ID, "wip/cursor/other-branch");
    const resolved = resolveRuntimeCodeTaskDeveloperPromptForExecute({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      taskId: "TASK-1",
      developerPrompt: prompt,
      developerPromptFingerprint: fingerprintRuntimeDeveloperPrompt(prompt),
      requirementsStateJson,
      targetRepository,
      baseBranch: "main",
      workBranch: WORK_BRANCH,
    });
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.reason).toBe("prompt_source_mismatch");
    expect(resolved.errors).toContain("prompt_work_branch_mismatch");
  });

  it("allows prompt without CodeTask reference lines", () => {
    const prompt = minimalRuntimePrompt(CODE_TASK_ID, WORK_BRANCH);
    const resolved = resolveRuntimeCodeTaskDeveloperPromptForExecute({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      taskId: "TASK-1",
      developerPrompt: prompt,
      requirementsStateJson,
      targetRepository,
      baseBranch: "main",
      workBranch: WORK_BRANCH,
    });
    expect(resolved.ok).toBe(true);
  });

  function developerAugmentationWithItems() {
    const item: UserProjectKnowledgeMemoryItem = {
      id: "p9:n9:developer",
      sourceProjectId: "p9",
      sourceNodeId: "n9",
      nodeType: "Feature",
      title: "T",
      summary: "S",
      lifecycle: "AUTO_CAPTURED",
      scope: "same_user",
      agent: "developer",
      relevance: 0.9,
      useAs: "implementation_hint",
      reason: "r",
      promptSummary: "Prior project layout hint",
    };
    const developerMemoryContext = buildUserProjectKnowledgeAgentPromptContext({
      agent: "developer",
      items: [item],
    });
    return { developerMemoryContext };
  }

  it("rebuilds when body prompt omits required developer memory augmentation", () => {
    const bodyOnly = minimalRuntimePrompt(CODE_TASK_ID, WORK_BRANCH);
    expect(
      storedDeveloperPromptMissingAugmentation({
        storedPrompt: bodyOnly,
        augmentation: developerAugmentationWithItems(),
      }),
    ).toBe(true);

    const resolved = resolveRuntimeCodeTaskDeveloperPromptForExecute({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      taskId: "TASK-1",
      developerPrompt: bodyOnly,
      developerPromptFingerprint: fingerprintRuntimeDeveloperPrompt(bodyOnly),
      requirementsStateJson,
      targetRepository,
      baseBranch: "main",
      workBranch: WORK_BRANCH,
      developerPromptAugmentation: developerAugmentationWithItems(),
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.promptSource).toBe("runtime_rebuilt");
    expect(resolved.prompt).toContain("[User Project Knowledge for Developer]");
    expect(resolved.prompt).toContain("Prior project layout hint");
    expect(resolved.prompt).not.toContain("p9:n9:developer");
  });

  it("allows request_body when developer memory is already in body prompt", () => {
    const bodyOnly = minimalRuntimePrompt(CODE_TASK_ID, WORK_BRANCH);
    const augmentation = developerAugmentationWithItems();
    const augmented = finalizeCodeTaskDeveloperPromptWithAugmentation({
      basePrompt: bodyOnly,
      augmentation,
    });
    const resolved = resolveRuntimeCodeTaskDeveloperPromptForExecute({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      taskId: "TASK-1",
      developerPrompt: augmented,
      developerPromptFingerprint: fingerprintRuntimeDeveloperPrompt(augmented),
      requirementsStateJson,
      targetRepository,
      baseBranch: "main",
      workBranch: WORK_BRANCH,
      developerPromptAugmentation: augmentation,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.promptSource).toBe("request_body");
    expect(resolved.prompt).toBe(augmented);
  });
});
