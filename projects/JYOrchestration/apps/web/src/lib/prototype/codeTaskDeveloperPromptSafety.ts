import {
  type CodeTaskPromptTargetRepoKind,
} from "@/lib/prototype/codeTaskPromptPathPolicy";
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
  "관련 최소 범위만 수정",
  "모노레포",
] as const;

const NARROW_PROBE_ONLY = new Set(["src/components", "src/app", "src/lib", "components", "app"]);

function sectionBulletCount(prompt: string, heading: string): number {
  const after = prompt.split(heading)[1];
  if (!after) return 0;
  const body = after.split(/^## /m)[0] ?? "";
  return body.split("\n").filter((line) => line.trim().startsWith("- ")).length;
}

function countMatches(prompt: string, pattern: RegExp): number {
  const m = prompt.match(pattern);
  return m?.length ?? 0;
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
  const codeTaskId = input.codeTaskId.trim();
  const workBranch = input.workBranch.trim();
  const roleKind = String(input.roleKind ?? "").trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  const headingCount = countMatches(prompt, /^# CodeTask 개발 요청$/gm);
  if (headingCount > 1) {
    errors.push("multiple_code_task_headings");
  }

  const workBranchCount = countMatches(prompt, /work branch:\s*`[^`]+`/gi);
  if (workBranchCount > 1) {
    errors.push("multiple_work_branches");
  }

  if (codeTaskId) {
    const uniqueIds = [
      ...new Set((prompt.match(/\bCODE-[A-Z0-9-]+\b/gi) ?? []).map((id) => id.toUpperCase())),
    ];
    if (uniqueIds.length > 1) {
      errors.push("foreign_code_task_id");
    } else if (uniqueIds.length === 1 && uniqueIds[0] !== codeTaskId.toUpperCase()) {
      errors.push("foreign_code_task_id");
    }
  }

  if (roleKind === "app_shell") {
    if (/LoadingState|Spinner|Skeleton|loading flag 기반/i.test(prompt)) {
      errors.push("app_shell_loading_template_leak");
    }
  }

  const probeSection = prompt.split("## 수정 대상 탐색 기준")[1]?.split(/^## /m)[0] ?? "";
  const probeBullets = probeSection
    .split("\n")
    .map((l) => l.trim().replace(/^-\s*/, ""))
    .filter(Boolean);
  if (!probeBullets.length) {
    errors.push("missing_probe_paths");
  } else {
    const onlyNarrow =
      probeBullets.length > 0 &&
      probeBullets.every((p) => NARROW_PROBE_ONLY.has(p) || (!p.includes("**") && !p.includes("*")));
    if (onlyNarrow && probeBullets.length <= 2) {
      warnings.push("narrow_probe_paths_only");
    }
  }

  const userLine = prompt.match(/핵심 사용자:\s*(.+)/)?.[1]?.trim() ?? "";
  if (userLine === "참여자" || userLine.length < 8) {
    warnings.push("weak_target_users");
  }

  if (sectionBulletCount(prompt, "## 구현 요구사항") < 3) {
    warnings.push("implementation_requirements_too_short");
  }

  if (sectionBulletCount(prompt, "## 검증 기준") < 2) {
    warnings.push("verification_checks_too_short");
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
    const workBranchMatch = prompt.match(/work branch:\s*`([^`]+)`/i);
    const workBranch = (input.workBranch ?? workBranchMatch?.[1] ?? "").trim();
    if (!workBranch) {
      errors.push("missing_work_branch");
    }
    if (!prompt.includes("## 구현 요구사항")) {
      errors.push("missing_implementation_requirements_section");
    } else if (sectionBulletCount(prompt, "## 구현 요구사항") < 3) {
      errors.push("implementation_requirements_too_short");
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
    if (prompt.includes("## Process Task") || prompt.includes("## CodeTask\n")) {
      errors.push("legacy_process_task_sections");
    }

    const codeTaskId = String(input.codeTaskId ?? "").trim();
    if (codeTaskId && workBranch) {
      const product = validateRuntimeCursorPromptProductQuality({
        prompt,
        codeTaskId,
        workBranch,
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
