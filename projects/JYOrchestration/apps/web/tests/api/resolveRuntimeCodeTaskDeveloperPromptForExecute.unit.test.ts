import { describe, expect, it } from "vitest";
import {
  fingerprintRuntimeDeveloperPrompt,
  resolveRuntimeCodeTaskDeveloperPromptForExecute,
} from "@/lib/prototype/resolveRuntimeCodeTaskDeveloperPromptForExecute";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";

const CODE_TASK_ID = "CODE-APP-SHELL-001";
const WORK_BRANCH = buildCodeTaskWorkBranch(CODE_TASK_ID);

function minimalRuntimePrompt(codeTaskId: string, workBranch: string): string {
  return [
    "# CodeTask 개발 요청",
    "",
    "## 작업 저장소",
    `- work branch: \`${workBranch}\``,
    "- owner/repo",
    "",
    "## 수정 대상 탐색 기준",
    "- apps/web/src/**/*.tsx",
    "",
    "## 구현 요구사항",
    "- a",
    "- b",
    "- c",
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
    "핵심 사용자: primary end users of the feature",
  ].join("\n");
}

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
        },
      ],
    },
    implementationTaskListV1: {
      version: "implementation_task_list_v1",
      tasks: [
        {
          id: "TASK-1",
          title: "Parent",
          description: "",
          type: "feature",
          priority: "P1",
          status: "ready",
        },
      ],
    },
  };

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
});
