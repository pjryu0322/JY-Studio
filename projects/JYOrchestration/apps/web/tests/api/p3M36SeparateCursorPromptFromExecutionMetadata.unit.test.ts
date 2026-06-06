import { describe, expect, it } from "vitest";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { buildDeveloperPromptMeta } from "@/lib/prototype/codeTaskDeveloperPromptCache";
import {
  CODE_TASK_DEVELOPER_PROMPT_VERSION,
  developerPromptContainsPlatformTrackingSections,
  formatDeveloperPromptHashSha256,
} from "@/lib/prototype/codeTaskDeveloperPromptDelivery";
import { buildCodeTaskExecutionMetadataFromRun } from "@/lib/prototype/codeTaskExecutionMetadata";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  fingerprintRuntimeDeveloperPrompt,
  resolveRuntimeCodeTaskDeveloperPromptForExecute,
} from "@/lib/prototype/resolveRuntimeCodeTaskDeveloperPromptForExecute";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import { tryBuildCodeTaskCursorExecutionRequest } from "@/lib/prototype/codeTaskExecutionRequest";
import {
  validateCodeTaskDeveloperPromptSafety,
  validateRuntimeCursorPromptProductQuality,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const NOW = "2026-06-04T00:00:00.000Z";
const REPO = {
  owner: "pjryu0322",
  repo: "aiprogect",
  defaultBranch: "main",
  repoFullName: "pjryu0322/aiprogect",
} as const;
const CODE_TASK_ID = "CODE-DEV-FRAME-001-001";
const WORK_BRANCH = buildCodeTaskWorkBranch(CODE_TASK_ID);

function sampleTask(overrides: Partial<ImplementationCodeTaskV1> = {}): ImplementationCodeTaskV1 {
  return {
    codeTaskId: CODE_TASK_ID,
    parentTaskId: "DEV-FRAME-001",
    title: "화면 프레임/앱 Shell 구성",
    description: "Shell",
    changeType: "component",
    acceptanceCriteria: ["shell", "layout", "panels"],
    verificationHints: ["render", "responsive"],
    forbiddenPaths: [],
    candidateFiles: [],
    candidateFileHints: [],
    ...overrides,
  };
}

describe("P3-M36 separate cursor prompt from execution metadata", () => {
  it("builds developer prompt without platform tracking sections", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: sampleTask(),
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    const prompt = built.prompt;
    expect(prompt).not.toContain("## 참조 ID");
    expect(prompt).not.toContain("Process Task ID");
    expect(prompt).not.toContain(`CodeTask: ${CODE_TASK_ID}`);
    expect(prompt).toContain("work branch");
    expect(prompt).toContain(REPO.repoFullName);
    expect(prompt).toContain(WORK_BRANCH);
    expect(developerPromptContainsPlatformTrackingSections(prompt)).toBe(false);
  });

  it("stores execution metadata fields on prompt build", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: sampleTask(),
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    const meta = buildDeveloperPromptMeta({
      developerPrompt: built.prompt,
      targetRepoFullName: REPO.repoFullName,
      baseBranch: "main",
      generatedAt: NOW,
    });
    expect(meta.developerPromptVersion).toBe(CODE_TASK_DEVELOPER_PROMPT_VERSION);
    expect(meta.developerPromptHash).toBe(formatDeveloperPromptHashSha256(built.prompt));

    const run: CodeTaskExecutionRunV1 = {
      version: "code_task_execution_run_v1",
      runId: "run-1",
      projectId: "p1",
      processTaskId: "DEV-FRAME-001",
      workItemId: "wi-1",
      codeTaskId: CODE_TASK_ID,
      status: "prompt_ready",
      attemptNo: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const metadata = buildCodeTaskExecutionMetadataFromRun({
      run,
      developerPrompt: built.prompt,
      developerPromptBuiltAt: NOW,
      targetRepository: REPO.repoFullName,
      baseBranch: "main",
      workBranch: WORK_BRANCH,
    });
    expect(metadata.processTaskId).toBe("DEV-FRAME-001");
    expect(metadata.codeTaskId).toBe(CODE_TASK_ID);
    expect(metadata.runId).toBe("run-1");
    expect(metadata.workBranch).toBe(WORK_BRANCH);
  });

  it("copy and execute paths share the same prompt hash", () => {
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      tasks: [sampleTask()],
    };
    const copy = resolveCodeTaskDeveloperPromptForCopy({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      codeTaskPlan: plan,
      taskList: null,
      cursorWorkItems: [
        {
          id: "wi-1",
          taskId: "DEV-FRAME-001",
          codeTaskId: CODE_TASK_ID,
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
      runs: [],
      targetRepository: REPO,
      baseBranch: "main",
    });
    expect(copy.ok).toBe(true);
    if (!copy.ok || !copy.prompt) return;

    const execute = resolveRuntimeCodeTaskDeveloperPromptForExecute({
      projectId: "p1",
      codeTaskId: CODE_TASK_ID,
      taskId: "DEV-FRAME-001",
      requirementsStateJson: { implementationCodeTaskPlanV1: plan },
      targetRepository: REPO,
      baseBranch: "main",
    });
    expect(execute.ok).toBe(true);
    if (!execute.ok) return;
    expect(fingerprintRuntimeDeveloperPrompt(copy.prompt)).toBe(execute.fingerprint);
  });

  it("quality gate passes without reference ID section", () => {
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: sampleTask(),
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    const safety = validateCodeTaskDeveloperPromptSafety({
      prompt: built.prompt,
      targetRepoFullName: REPO.repoFullName,
      targetRepoKind: "generated_project",
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
    });
    expect(safety.ok).toBe(true);
    const product = validateRuntimeCursorPromptProductQuality({
      prompt: built.prompt,
      codeTaskId: CODE_TASK_ID,
      workBranch: WORK_BRANCH,
    });
    expect(product.ok).toBe(true);
    expect(product.errors).not.toContain("missing_code_task_reference_id");
  });

  it("rebuilds legacy stored prompt on execute request build", () => {
    const legacyPrompt = [
      "# CodeTask 개발 요청",
      "## 참조 ID",
      `- CodeTask: ${CODE_TASK_ID}`,
      "## 작업 저장소",
      `- 작업 대상 저장소: \`${REPO.repoFullName}\``,
      `- work branch: \`${WORK_BRANCH}\``,
      "## 구현 요구사항",
      "- a",
      "- b",
      "- c",
      "## 검증 기준",
      "- v1",
      "- v2",
      "## 금지사항",
      "- x",
      "## 완료 기준",
      "- done",
      "## 수정 대상 탐색 기준",
      "- src/**",
    ].join("\n");
    const run: CodeTaskExecutionRunV1 = {
      version: "code_task_execution_run_v1",
      runId: "run-legacy",
      projectId: "p1",
      processTaskId: "DEV-FRAME-001",
      workItemId: "wi-1",
      codeTaskId: CODE_TASK_ID,
      status: "prompt_ready",
      attemptNo: 1,
      developerPrompt: legacyPrompt,
      developerPromptMeta: buildDeveloperPromptMeta({
        developerPrompt: legacyPrompt,
        targetRepoFullName: REPO.repoFullName,
        baseBranch: "main",
        generatedAt: NOW,
      }),
      createdAt: NOW,
      updatedAt: NOW,
    };
    const built = tryBuildCodeTaskCursorExecutionRequest({
      projectId: "p1",
      run,
      codeTask: sampleTask(),
      workItem: {
        id: "wi-1",
        taskId: "DEV-FRAME-001",
        codeTaskId: CODE_TASK_ID,
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
      targetRepository: REPO,
      baseBranch: "main",
      nowIso: NOW,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.built.developerPrompt).not.toContain("## 참조 ID");
    expect(built.built.run.processTaskId).toBe("DEV-FRAME-001");
    expect(built.built.run.codeTaskId).toBe(CODE_TASK_ID);
  });
});
