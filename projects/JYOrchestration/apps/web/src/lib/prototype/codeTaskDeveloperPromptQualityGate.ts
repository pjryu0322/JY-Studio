import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import type { CodeTaskPromptQualityV1 } from "@/lib/prototype/generatedCodeTaskPrompt";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { validateCodeTaskDeveloperPromptSafety } from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import type { CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";
import {
  resolveCodeTaskWorkBranchForTask,
  resolveCodeTaskBaseBranchForTask,
} from "@/lib/prototype/taskCursorExecution";

export type DeveloperPromptReadiness = CodeTaskPromptQualityV1["readiness"];

export const STAGE_TWO_CURSOR_BLOCK_MESSAGE =
  "Cursor 실행용 2단계 개발 프롬프트가 아닙니다.\n현재 프롬프트는 전체 CodeTask 계획서입니다.\n선택된 CodeTask 기준 개발 프롬프트를 먼저 생성해야 합니다." as const;

export const BRANCH_PLAN_REGRESSION_MESSAGE =
  "Branch Plan 기준 브랜치가 상속되지 않았습니다.\n현재 base branch가 main으로 되돌아갔습니다.\n기획단계 Branch Plan의 baseBranch를 사용해야 합니다." as const;

const STAGE_ONE_HEADING = "# CodeTask 1단계 프롬프트 초안";

export function isStageOnePlanningSummaryPromptContent(prompt: string): boolean {
  const text = String(prompt ?? "");
  if (text.startsWith(STAGE_ONE_HEADING)) return true;
  if (text.includes("## 프로젝트 구현 준비 요약")) return true;
  if (text.includes("## CodeTask 목록")) {
    const sectionCount = (text.match(/^### \d+\./gm) ?? []).length;
    if (sectionCount > 1) return true;
  }
  return false;
}

export function evaluateBranchPlanBranchRegression(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly fallbackBaseBranch?: string | null;
}): Readonly<{ readonly errors: readonly string[] }> {
  const bp = input.codeTask.branchPlan;
  if (!bp) return { errors: [] };
  const errors: string[] = [];
  const workBranch = resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask });
  const baseBranch = resolveCodeTaskBaseBranchForTask({
    codeTask: input.codeTask,
    fallbackBaseBranch: input.fallbackBaseBranch,
  });
  if (/^wip\/cursor\/code-dev/i.test(workBranch)) {
    errors.push("blocked_legacy_branch");
  }
  if (bp.branchGroup !== "foundation" && baseBranch === "main") {
    errors.push("branch_plan_base_regressed_to_main");
  }
  return { errors };
}

export function evaluateStageTwoDeveloperPromptContent(input: {
  readonly prompt: string;
  readonly codeTaskId?: string | null;
}): Readonly<{ readonly readiness: DeveloperPromptReadiness; readonly missing: readonly string[] }> {
  const prompt = String(input.prompt ?? "").trim();
  const missing: string[] = [];
  if (!prompt) {
    return { readiness: "blocked_incomplete_inputs", missing: ["empty_prompt"] };
  }
  if (isStageOnePlanningSummaryPromptContent(prompt)) {
    return { readiness: "blocked_stage_one_prompt", missing: ["stage_one_planning_summary"] };
  }
  if (!prompt.startsWith("# CodeTask 개발 요청")) {
    missing.push("missing_stage_two_heading");
  }
  if (!prompt.includes("## 작업 저장소")) missing.push("missing_repo_section");
  if (!prompt.includes("## Branch Plan") && !prompt.includes("branch group:")) {
    missing.push("missing_branch_plan_section");
  }
  if (!/base branch:/i.test(prompt)) missing.push("missing_base_branch");
  if (!/work branch:/i.test(prompt)) missing.push("missing_work_branch");
  if (!prompt.includes("## 수정 허용 파일")) missing.push("missing_allowed_files_section");
  if (!prompt.includes("## 수정 금지 파일")) missing.push("missing_forbidden_files_section");
  if (!prompt.includes("## 완료 기준")) missing.push("missing_completion_section");

  const headingCount = prompt.split("\n").filter((l) => l.trim() === "# CodeTask 개발 요청").length;
  if (headingCount > 1) {
    return { readiness: "blocked_multiple_codetasks", missing: ["multiple_runtime_prompt_headings"] };
  }

  if (missing.length) {
    return { readiness: "blocked_quality_gate", missing };
  }
  return { readiness: "ready", missing: [] };
}

export function evaluateStageTwoDeveloperPromptReadiness(input: {
  readonly prompt: string;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly promptContextPresent: boolean;
  readonly targetRepoFullName: string;
  readonly roleKind?: CodeTaskRoleKind | string | null;
  readonly fallbackBaseBranch?: string | null;
}): CodeTaskPromptQualityV1 {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!input.promptContextPresent) {
    missing.push("promptContext");
  }
  const bp = input.codeTask.branchPlan;
  if (!bp?.workBranch?.trim() || !bp?.baseBranch?.trim()) {
    missing.push("branchPlan");
  }
  const boundary = parseCodeTaskFileBoundaryV1(input.codeTask.fileBoundary);
  if (!boundary?.ownedFiles?.length || !boundary?.forbiddenFiles?.length) {
    missing.push("fileBoundary");
  }

  const branchRegression = evaluateBranchPlanBranchRegression({
    codeTask: input.codeTask,
    fallbackBaseBranch: input.fallbackBaseBranch,
  });
  if (branchRegression.errors.length) {
    for (const e of branchRegression.errors) missing.push(e);
  }

  const contentGate = evaluateStageTwoDeveloperPromptContent({
    prompt: input.prompt,
    codeTaskId: input.codeTask.codeTaskId,
  });
  missing.push(...contentGate.missing);

  let readiness: DeveloperPromptReadiness = contentGate.readiness;
  if (missing.includes("branchPlan")) readiness = "blocked_missing_branch_plan";
  else if (missing.includes("fileBoundary")) readiness = "blocked_missing_file_boundary";
  else if (missing.some((m) => m.includes("legacy") || m.includes("branch_plan_base"))) {
    readiness = "blocked_legacy_branch";
  } else if (missing.includes("promptContext")) readiness = "blocked_incomplete_inputs";

  const workBranch = resolveCodeTaskWorkBranchForTask({ codeTask: input.codeTask });
  const safety = validateCodeTaskDeveloperPromptSafety({
    prompt: input.prompt,
    targetRepoFullName: input.targetRepoFullName,
    targetRepoKind: "generated_project",
    codeTaskId: input.codeTask.codeTaskId,
    workBranch,
    roleKind: input.roleKind,
  });
  if (!safety.ok) {
    missing.push(...safety.errors);
    readiness = readiness === "ready" ? "blocked_quality_gate" : readiness;
  }
  warnings.push(...safety.warnings);

  const ready =
    readiness === "ready" &&
    missing.length === 0 &&
    contentGate.readiness === "ready" &&
    safety.ok;

  return {
    ready,
    readiness: ready ? "ready" : readiness,
    missing: [...new Set(missing)],
    warnings: [...new Set(warnings)],
  };
}

export function isDeveloperPromptBundleContent(prompt: string): boolean {
  return String(prompt ?? "").trimStart().startsWith("# CodeTask Developer Prompt Bundle");
}

export function assertStageTwoDeveloperPromptAllowed(input: {
  readonly prompt: string;
  readonly stage?: string | null;
}): Readonly<{ readonly ok: boolean; readonly message: string; readonly errors: readonly string[] }> {
  if (input.stage === "stage_one_planning_summary") {
    return { ok: false, message: STAGE_TWO_CURSOR_BLOCK_MESSAGE, errors: ["stage_one_planning_summary"] };
  }
  if (isDeveloperPromptBundleContent(input.prompt)) {
    return {
      ok: false,
      message: STAGE_TWO_CURSOR_BLOCK_MESSAGE,
      errors: ["developer_prompt_bundle_not_for_cursor_execute"],
    };
  }
  if (isStageOnePlanningSummaryPromptContent(input.prompt)) {
    return { ok: false, message: STAGE_TWO_CURSOR_BLOCK_MESSAGE, errors: ["stage_one_planning_summary"] };
  }
  const content = evaluateStageTwoDeveloperPromptContent({ prompt: input.prompt });
  if (content.readiness !== "ready") {
    return {
      ok: false,
      message: STAGE_TWO_CURSOR_BLOCK_MESSAGE,
      errors: content.missing,
    };
  }
  return { ok: true, message: "", errors: [] };
}
