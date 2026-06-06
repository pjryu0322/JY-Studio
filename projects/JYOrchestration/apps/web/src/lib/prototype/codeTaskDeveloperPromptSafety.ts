import {
  type CodeTaskPromptTargetRepoKind,
} from "@/lib/prototype/codeTaskPromptPathPolicy";
import { developerPromptContainsPlatformTrackingSections } from "@/lib/prototype/codeTaskDeveloperPromptDelivery";
import type { CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";

const GENERATED_FULL_PROMPT_BANNED = [
  "projects/JYOrchestration",
  "projects/JYGallery",
  "projects/JYAccount",
  "projects/chunk-studio",
  "projects/Chunk Studio",
  "cd projects/JYOrchestration",
  "Stage1/Stage2/ENV_TEST",
  "JYOrchestration 플랫폼",
  "JYOrchestration",
  "JYGallery",
  "JYAccount",
  "플랫폼 소스",
  "플랫폼 허용 경로",
  "projects/JYOrchestration 외 경로",
  "플랫폼 허용 경로 미지정",
  "모노레포",
] as const;

const NARROW_PROBE_ONLY = new Set(["src/components", "src/app", "src/lib", "components", "app"]);

const RUNTIME_PROMPT_HEADING = /^# CodeTask 개발 요청\s*$/;
const WORK_BRANCH_LINE = /^- work branch:\s*`([^`]+)`\s*$/i;
const CODE_TASK_REF_LINE = /^- CodeTask:\s*(.+?)\s*$/i;
const CODE_TASK_ID_LINE = /^CodeTask ID:\s*(.+?)\s*$/i;

const APP_SHELL_FORBIDDEN_FEATURE_TERMS = [
  "LoadingState",
  "Spinner",
  "Skeleton",
  "loading flag 기반 표시/숨김",
  "loading flag",
] as const;

export type RuntimePromptQualityGateDiagnostics = Readonly<{
  readonly event: "runtime_prompt_quality_gate_failed";
  readonly codeTaskId: string;
  readonly workBranch: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}>;

export function buildRuntimePromptQualityGateDiagnostics(input: {
  readonly codeTaskId: string;
  readonly workBranch: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}): RuntimePromptQualityGateDiagnostics {
  return {
    event: "runtime_prompt_quality_gate_failed",
    codeTaskId: input.codeTaskId.trim(),
    workBranch: input.workBranch.trim(),
    errors: input.errors,
    warnings: input.warnings,
  };
}

export function logRuntimePromptQualityGateFailure(diagnostics: RuntimePromptQualityGateDiagnostics): void {
  console.warn("[runtime_prompt_quality_gate]", JSON.stringify(diagnostics));
}

function sectionBulletCount(prompt: string, heading: string): number {
  const after = prompt.split(heading)[1];
  if (!after) return 0;
  const body = after.split(/^## /m)[0] ?? "";
  return body.split("\n").filter((line) => line.trim().startsWith("- ")).length;
}

function countRuntimePromptHeadings(prompt: string): number {
  return prompt.split("\n").filter((line) => RUNTIME_PROMPT_HEADING.test(line.trim())).length;
}

export function extractWorkBranchLines(prompt: string): readonly string[] {
  return prompt
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => WORK_BRANCH_LINE.test(line))
    .map((line) => WORK_BRANCH_LINE.exec(line)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

/** 참조 ID 등 명시 라인에서만 CodeTask ID를 추출한다 (work branch slug 오탐 방지). */
export function extractReferencedCodeTaskIds(prompt: string): readonly string[] {
  const ids: string[] = [];
  for (const line of prompt.split("\n")) {
    const trimmed = line.trim();
    const ref = CODE_TASK_REF_LINE.exec(trimmed);
    if (ref?.[1]) ids.push(ref[1].trim().toUpperCase());
    const explicit = CODE_TASK_ID_LINE.exec(trimmed);
    if (explicit?.[1]) ids.push(explicit[1].trim().toUpperCase());
  }
  return [...new Set(ids)];
}

export function validateRuntimeCursorPromptProductQuality(input: {
  readonly prompt: string;
  readonly codeTaskId: string;
  readonly workBranch: string;
  readonly roleKind?: CodeTaskRoleKind | string | null;
}): Readonly<{
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}> {
  const prompt = String(input.prompt ?? "");
  const codeTaskId = input.codeTaskId.trim().toUpperCase();
  const expectedWorkBranch = input.workBranch.trim();
  const roleKind = String(input.roleKind ?? "").trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  const headingCount = countRuntimePromptHeadings(prompt);
  if (headingCount === 0) {
    errors.push("missing_runtime_prompt_heading");
  } else if (headingCount > 1) {
    errors.push("multiple_runtime_prompt_headings");
  }

  const workBranches = extractWorkBranchLines(prompt);
  if (workBranches.length === 0) {
    errors.push("missing_work_branch_line");
  } else if (workBranches.length > 1) {
    errors.push("multiple_work_branches");
  } else if (expectedWorkBranch && workBranches[0] !== expectedWorkBranch) {
    errors.push("unexpected_work_branch");
  }

  const referencedIds = extractReferencedCodeTaskIds(prompt);
  if (referencedIds.length) {
    const uniqueRefs = [...new Set(referencedIds)];
    if (codeTaskId) {
      const foreignCodeIds = uniqueRefs.filter(
        (id) => id.startsWith("CODE-") && id !== codeTaskId.trim().toUpperCase(),
      );
      if (foreignCodeIds.length > 0 || (uniqueRefs.length === 1 && uniqueRefs[0] !== codeTaskId.trim().toUpperCase())) {
        errors.push("multiple_or_unexpected_code_task_ids");
      }
    }
    warnings.push("legacy_platform_tracking_in_prompt");
  } else if (developerPromptContainsPlatformTrackingSections(prompt)) {
    warnings.push("legacy_platform_tracking_in_prompt");
  }

  if (roleKind === "app_shell") {
    for (const term of APP_SHELL_FORBIDDEN_FEATURE_TERMS) {
      if (prompt.includes(term)) {
        errors.push("app_shell_contains_loading_component_template");
        break;
      }
    }
  }

  const probeSection = prompt.split("## 수정 대상 탐색 기준")[1]?.split(/^## /m)[0] ?? "";
  const pathBullets = probeSection
    .split("\n")
    .map((l) => l.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s*/, ""))
    .filter((line) => !/^우선\s*탐색\s*경로/.test(line) && !/대상\s*저장소/.test(line) && !/실제\s*저장소/.test(line));
  if (!pathBullets.length) {
    errors.push("missing_probe_paths");
  } else {
    const globBullets = pathBullets.filter((p) => p.includes("*"));
    const onlyNarrow =
      globBullets.length === 0 &&
      pathBullets.length > 0 &&
      pathBullets.length <= 2 &&
      pathBullets.every((p) => NARROW_PROBE_ONLY.has(p));
    if (onlyNarrow) {
      warnings.push("narrow_probe_paths_only");
    }
  }

  const userLine = prompt.match(/핵심 사용자:\s*(.+)/)?.[1]?.trim() ?? "";
  if (userLine === "참여자" || userLine.length < 8) {
    warnings.push("weak_target_users");
  }

  if (sectionBulletCount(prompt, "## 구현 요구사항") < 3) {
    warnings.push("insufficient_implementation_requirements");
  }

  if (sectionBulletCount(prompt, "## 검증 기준") < 2) {
    warnings.push("insufficient_verification_checks");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateCodeTaskDeveloperPromptSafety(input: {
  readonly prompt: string;
  readonly targetRepoFullName: string;
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
  readonly allowedPathGlobs?: readonly string[];
  readonly codeTaskId?: string;
  readonly workBranch?: string;
  readonly roleKind?: CodeTaskRoleKind | string | null;
}): {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
} {
  const prompt = String(input.prompt ?? "");
  const kind = input.targetRepoKind ?? "generated_project";
  const errors: string[] = [];
  const warnings: string[] = [];
  const repo = input.targetRepoFullName.trim();

  if (!prompt.trim()) {
    errors.push("empty_prompt");
    return { ok: false, errors, warnings };
  }

  const codeTaskId = String(input.codeTaskId ?? "").trim();
  const expectedWorkBranch = String(input.workBranch ?? "").trim();

  if (kind === "generated_project") {
    for (const snippet of GENERATED_FULL_PROMPT_BANNED) {
      if (prompt.includes(snippet)) {
        errors.push(`banned_snippet:${snippet}`);
      }
    }

    if (!prompt.includes("## 작업 저장소")) {
      errors.push("missing_repo_section");
    }
    if (repo && !prompt.includes(repo)) {
      errors.push("missing_target_repo_full_name");
    }
    if (!expectedWorkBranch && extractWorkBranchLines(prompt).length === 0) {
      errors.push("missing_work_branch");
    }
    if (!prompt.includes("## 구현 요구사항")) {
      errors.push("missing_implementation_requirements_section");
    }
    if (!prompt.includes("## 검증 기준")) {
      errors.push("missing_verification_section");
    }
    if (!prompt.includes("## 금지사항")) {
      errors.push("missing_forbidden_section");
    }
    if (prompt.includes("## 허용 경로")) {
      errors.push("legacy_allowed_paths_section");
    }
    if (!prompt.includes("## 완료 기준")) {
      errors.push("missing_completion_criteria_section");
    }
    if (developerPromptContainsPlatformTrackingSections(prompt)) {
      warnings.push("legacy_platform_tracking_in_prompt");
    }
    if (prompt.includes("## Process Task") || prompt.includes("## CodeTask\n")) {
      errors.push("legacy_process_task_sections");
    }

    if (codeTaskId && expectedWorkBranch) {
      const product = validateRuntimeCursorPromptProductQuality({
        prompt,
        codeTaskId,
        workBranch: expectedWorkBranch,
        roleKind: input.roleKind,
      });
      errors.push(...product.errors);
      warnings.push(...product.warnings);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export const CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE =
  "Cursor 전달 프롬프트 품질 검사를 통과하지 못해 실행을 차단했습니다.";

export const CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE =
  "Cursor 전달 프롬프트 품질 검사를 통과하지 못해 복사를 차단했습니다.";
