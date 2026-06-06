import { createHash } from "node:crypto";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  buildDeveloperPromptMeta,
  shouldReuseStoredDeveloperPrompt,
} from "@/lib/prototype/codeTaskDeveloperPromptCache";
import {
  extractWorkBranchLines,
} from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  getCodeTaskPromptContextFromMap,
  parseCodeTaskPromptContextMapV1,
  type CodeTaskPromptContextMapV1,
} from "@/lib/prototype/codeTaskPromptContext";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  parseImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
import { buildCodeTaskWorkBranch } from "@/lib/prototype/taskCursorExecution";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  parseImplementationTaskListV1,
  type ImplementationTaskV1,
} from "@/lib/requirements/implementationTaskList";

export type RuntimeDeveloperPromptSource = "request_body" | "db_run" | "runtime_rebuilt";

export function fingerprintRuntimeDeveloperPrompt(prompt: string): string {
  return createHash("sha256").update(String(prompt ?? ""), "utf8").digest("hex");
}

export type ResolveRuntimeCodeTaskDeveloperPromptForExecuteInput = Readonly<{
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly developerPrompt?: string | null;
  readonly developerPromptFingerprint?: string | null;
  readonly promptSource?: string | null;
  readonly workBranch?: string | null;
  readonly requirementsStateJson: Record<string, unknown> | null | undefined;
  readonly targetRepository: ProjectTargetRepository;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly scopedWorkItem?: CursorWorkItem | null;
}>;

export type ResolveRuntimeCodeTaskDeveloperPromptForExecuteResult =
  | Readonly<{
      readonly ok: true;
      readonly prompt: string;
      readonly promptSource: RuntimeDeveloperPromptSource;
      readonly fingerprint: string;
      readonly workBranch: string;
      readonly codeTask: ImplementationCodeTaskV1;
      readonly parentTask: ImplementationTaskV1 | null;
      readonly run: CodeTaskExecutionRunV1 | null;
    }>
  | Readonly<{
      readonly ok: false;
      readonly reason: "prompt_source_mismatch" | "runtime_developer_prompt_unavailable";
      readonly message: string;
      readonly errors: readonly string[];
    }>;

function assertPromptMatchesCodeTask(input: {
  readonly prompt: string;
  readonly codeTaskId: string;
  readonly expectedWorkBranch: string;
  readonly bodyWorkBranch?: string | null;
}): readonly string[] {
  const errors: string[] = [];
  const codeTaskId = input.codeTaskId.trim().toUpperCase();
  const expectedWorkBranch = input.expectedWorkBranch.trim();
  const bodyBranch = String(input.bodyWorkBranch ?? "").trim();
  if (bodyBranch && bodyBranch !== expectedWorkBranch) {
    errors.push("body_work_branch_mismatch");
  }
  const branches = extractWorkBranchLines(input.prompt);
  if (branches.length === 1 && branches[0] !== expectedWorkBranch) {
    errors.push("prompt_work_branch_mismatch");
  }
  return errors;
}

export function resolveRuntimeCodeTaskDeveloperPromptForExecute(
  input: ResolveRuntimeCodeTaskDeveloperPromptForExecuteInput,
): ResolveRuntimeCodeTaskDeveloperPromptForExecuteResult {
  const codeTaskId = input.codeTaskId.trim();
  if (!codeTaskId) {
    return {
      ok: false,
      reason: "runtime_developer_prompt_unavailable",
      message: "codeTaskId가 필요합니다.",
      errors: ["missing_code_task_id"],
    };
  }

  const state = parseRequirementsStateJson(input.requirementsStateJson) ?? {};
  const plan = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1);
  const codeTask = plan?.tasks.find((t) => t.codeTaskId === codeTaskId) ?? null;
  if (!codeTask) {
    return {
      ok: false,
      reason: "runtime_developer_prompt_unavailable",
      message: `CodeTask ${codeTaskId}를 찾을 수 없습니다.`,
      errors: ["code_task_not_in_plan"],
    };
  }

  const taskList = parseImplementationTaskListV1(state.implementationTaskListV1);
  const parentTask =
    taskList?.tasks.find((t) => t.id === codeTask.parentTaskId) ?? null;

  const expectedWorkBranch = buildCodeTaskWorkBranch(codeTaskId);
  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: input.targetRepository.repoFullName,
    targetRepoKind: "generated_project",
  });
  const promptContextMap = parseCodeTaskPromptContextMapV1(
    state.codeTaskPromptContextMapV1,
  ) as CodeTaskPromptContextMapV1 | null;
  const promptContext = getCodeTaskPromptContextFromMap(promptContextMap, codeTaskId);
  const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
  const run = findLatestRunForCodeTask(runs, codeTaskId);

  const bodyPrompt = String(input.developerPrompt ?? "").trim();
  const bodyFingerprint = String(input.developerPromptFingerprint ?? "").trim();

  if (bodyPrompt) {
    const fingerprint = fingerprintRuntimeDeveloperPrompt(bodyPrompt);
    if (bodyFingerprint && bodyFingerprint !== fingerprint) {
      return {
        ok: false,
        reason: "prompt_source_mismatch",
        message: "developerPromptFingerprint가 일치하지 않습니다.",
        errors: ["fingerprint_mismatch"],
      };
    }
    const mismatchErrors = assertPromptMatchesCodeTask({
      prompt: bodyPrompt,
      codeTaskId,
      expectedWorkBranch,
      bodyWorkBranch: input.workBranch,
    });
    if (mismatchErrors.length) {
      return {
        ok: false,
        reason: "prompt_source_mismatch",
        message: "요청 prompt와 CodeTask/work branch가 일치하지 않습니다.",
        errors: mismatchErrors,
      };
    }
    return {
      ok: true,
      prompt: bodyPrompt,
      promptSource: "request_body",
      fingerprint,
      workBranch: expectedWorkBranch,
      codeTask,
      parentTask,
      run,
    };
  }

  if (
    run?.developerPrompt?.trim() &&
    shouldReuseStoredDeveloperPrompt({
      run,
      promptContext,
      targetRepoFullName: input.targetRepository.repoFullName,
      baseBranch: input.baseBranch,
      allowedPathGlobs,
    })
  ) {
    const prompt = run.developerPrompt.trim();
    const fingerprint = fingerprintRuntimeDeveloperPrompt(prompt);
    const mismatchErrors = assertPromptMatchesCodeTask({
      prompt,
      codeTaskId,
      expectedWorkBranch,
      bodyWorkBranch: input.workBranch,
    });
    if (mismatchErrors.length) {
      return {
        ok: false,
        reason: "prompt_source_mismatch",
        message: "저장된 prompt와 CodeTask/work branch가 일치하지 않습니다.",
        errors: mismatchErrors,
      };
    }
    return {
      ok: true,
      prompt,
      promptSource: "db_run",
      fingerprint,
      workBranch: expectedWorkBranch,
      codeTask,
      parentTask,
      run,
    };
  }

  const rebuilt = buildCodeTaskDeveloperPromptDetailed({
    codeTask,
    parentTask,
    promptContext,
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoKind: "generated_project",
  });
  const prompt = rebuilt.prompt.trim();
  if (!prompt) {
    return {
      ok: false,
      reason: "runtime_developer_prompt_unavailable",
      message: "Runtime developer prompt를 생성할 수 없습니다.",
      errors: ["empty_rebuilt_prompt"],
    };
  }

  const fingerprint = fingerprintRuntimeDeveloperPrompt(prompt);
  void buildDeveloperPromptMeta({
    developerPrompt: prompt,
    promptContext,
    targetRepoFullName: input.targetRepository.repoFullName,
    baseBranch: input.baseBranch,
    allowedPathGlobs,
    generatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    prompt,
    promptSource: "runtime_rebuilt",
    fingerprint,
    workBranch: expectedWorkBranch,
    codeTask,
    parentTask,
    run,
  };
}
