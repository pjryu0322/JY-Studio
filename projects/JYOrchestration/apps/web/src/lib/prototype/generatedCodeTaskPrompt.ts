import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { CodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";

export type CodeTaskPromptStageV1 =
  | "stage_one_planning_summary"
  | "stage_two_developer_execution";

export type CodeTaskPromptQualityV1 = Readonly<{
  readonly ready: boolean;
  readonly readiness:
    | "ready"
    | "blocked_stage_one_prompt"
    | "blocked_missing_branch_plan"
    | "blocked_missing_file_boundary"
    | "blocked_legacy_branch"
    | "blocked_multiple_codetasks"
    | "blocked_incomplete_inputs"
    | "blocked_quality_gate";
  readonly missing: readonly string[];
  readonly warnings: readonly string[];
}>;

export type GeneratedCodeTaskPromptV1 = Readonly<{
  readonly stage: CodeTaskPromptStageV1;
  readonly codeTaskId?: string | null;
  readonly title: string;
  readonly content: string;
  readonly quality: CodeTaskPromptQualityV1;
}>;

export function buildGeneratedStageOnePlanningSummaryPrompt(input: {
  readonly title?: string;
  readonly content: string;
  readonly ready?: boolean;
}): GeneratedCodeTaskPromptV1 {
  const content = String(input.content ?? "").trim();
  return {
    stage: "stage_one_planning_summary",
    codeTaskId: null,
    title: input.title?.trim() || "CodeTask 1단계 계획 프롬프트",
    content,
    quality: {
      ready: input.ready !== false && Boolean(content),
      readiness: "ready",
      missing: [],
      warnings: [],
    },
  };
}

export function buildGeneratedStageTwoDeveloperPrompt(input: {
  readonly codeTaskId: string;
  readonly title: string;
  readonly content: string;
  readonly quality: CodeTaskPromptQualityV1;
}): GeneratedCodeTaskPromptV1 {
  return {
    stage: "stage_two_developer_execution",
    codeTaskId: input.codeTaskId.trim(),
    title: input.title.trim() || "CodeTask 개발 요청",
    content: input.content.trim(),
    quality: input.quality,
  };
}

export function stageTwoDeveloperPromptInputsPresent(input: {
  readonly branchPlan?: CodeTaskBranchPlanV1 | null;
  readonly fileBoundary?: CodeTaskFileBoundaryV1 | null;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
}): readonly string[] {
  const missing: string[] = [];
  const bp = input.branchPlan;
  if (!bp?.workBranch?.trim()) missing.push("branchPlan.workBranch");
  if (!bp?.baseBranch?.trim()) missing.push("branchPlan.baseBranch");
  const fb = input.fileBoundary;
  if (!fb?.ownedFiles?.length) missing.push("fileBoundary.ownedFiles");
  if (!fb?.forbiddenFiles?.length) missing.push("fileBoundary.forbiddenFiles");
  if (!input.promptContext) missing.push("promptContext");
  return missing;
}
