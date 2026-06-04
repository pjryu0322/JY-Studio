import {
  isPlatformInternalPath,
  resolveDefaultAllowedPathGlobsForTargetRepo,
  type CodeTaskPromptTargetRepoKind,
} from "@/lib/prototype/codeTaskPromptPathPolicy";

const PLATFORM_SNIPPETS = [
  "projects/JYOrchestration/",
  "projects/JYGallery/",
  "projects/JYAccount/",
  "projects/Chunk Studio/",
  "projects/chunk-studio/",
] as const;

const BANNED_PROMPT_PHRASES = [
  "플랫폼 허용 경로 미지정",
  "관련 최소 범위만 수정",
] as const;

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

  if (!prompt.trim()) {
    errors.push("empty_prompt");
    return { ok: false, errors, warnings };
  }

  if (kind === "generated_project") {
    for (const phrase of BANNED_PROMPT_PHRASES) {
      if (prompt.includes(phrase)) {
        errors.push(`banned_phrase:${phrase}`);
      }
    }

    const candidateSection = prompt.split("## 수정 대상 파일 후보")[1]?.split("##")[0] ?? "";
    if (candidateSection) {
      const lines = candidateSection
        .split("\n")
        .map((l) => l.replace(/^-\s*/, "").trim())
        .filter(Boolean);
      for (const line of lines) {
        if (line.includes("대상 저장소") || line.includes("탐색")) continue;
        for (const snippet of PLATFORM_SNIPPETS) {
          if (line.includes(snippet)) {
            errors.push(`platform_path_in_candidate:${snippet}`);
          }
        }
        if (line.includes("../../")) {
          errors.push("parent_traversal_in_candidate");
        }
      }
      const unsafe = lines.filter(
        (line) =>
          !line.includes("대상 저장소") &&
          !line.includes("탐색") &&
          isPlatformInternalPath(line),
      );
      if (unsafe.length && lines.every((l) => isPlatformInternalPath(l) || unsafe.includes(l))) {
        errors.push("all_candidate_paths_platform_internal");
      }
    }

    const allowed =
      input.allowedPathGlobs?.filter(Boolean).length
        ? input.allowedPathGlobs!
        : resolveDefaultAllowedPathGlobsForTargetRepo({
            targetRepoFullName: input.targetRepoFullName,
            targetRepoKind: kind,
          });
    const hasAllowedSection =
      prompt.includes("## 허용 경로") &&
      allowed.some((g) => prompt.includes(g.replace(/\*\*$/, "").replace(/\*$/, "")));
    if (!hasAllowedSection && !allowed.some((g) => prompt.includes(g))) {
      errors.push("missing_allowed_paths_in_prompt");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export const CODE_TASK_PROMPT_SAFETY_BLOCK_MESSAGE =
  "프롬프트 대상 경로가 잘못되어 Cursor 실행을 차단했습니다.";

export const CODE_TASK_PROMPT_COPY_BLOCK_MESSAGE =
  "플랫폼 내부 경로가 포함되어 복사/실행을 차단했습니다.";
