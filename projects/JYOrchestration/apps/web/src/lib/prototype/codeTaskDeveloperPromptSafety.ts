import {
  type CodeTaskPromptTargetRepoKind,
} from "@/lib/prototype/codeTaskPromptPathPolicy";

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

function sectionBulletCount(prompt: string, heading: string): number {
  const after = prompt.split(heading)[1];
  if (!after) return 0;
  const body = after.split(/^## /m)[0] ?? "";
  return body.split("\n").filter((line) => line.trim().startsWith("- ")).length;
}

export function validateCodeTaskDeveloperPromptSafety(input: {
  readonly prompt: string;
  readonly targetRepoFullName: string;
  readonly targetRepoKind?: CodeTaskPromptTargetRepoKind;
  readonly allowedPathGlobs?: readonly string[];
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
    if (!workBranchMatch?.[1]?.trim()) {
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
  }

  return { ok: errors.length === 0, errors, warnings };
}

export const CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE =
  "프롬프트 대상 경로가 잘못되어 Cursor 실행을 차단했습니다.";

export const CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE =
  "Cursor 전달 프롬프트에 대상 저장소 밖 정보가 포함되어 복사를 차단했습니다.";
