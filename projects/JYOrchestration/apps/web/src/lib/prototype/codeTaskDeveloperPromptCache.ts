import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  CODE_TASK_DEVELOPER_PROMPT_VERSION,
  developerPromptContainsPlatformTrackingSections,
  formatDeveloperPromptHashSha256,
} from "@/lib/prototype/codeTaskDeveloperPromptDelivery";
import { validateCodeTaskDeveloperPromptSafety } from "@/lib/prototype/codeTaskDeveloperPromptSafety";
import { resolveEffectiveAllowedPathGlobs } from "@/lib/prototype/codeTaskPromptPathPolicy";
import type { CodeTaskDeveloperPromptAugmentation } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";
import { storedDeveloperPromptMissingAugmentation } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";

export type CodeTaskDeveloperPromptMeta = Readonly<{
  readonly promptContextUpdatedAt?: string;
  readonly targetRepoFullName?: string;
  readonly baseBranch?: string;
  readonly allowedPathHash?: string;
  readonly generatedAt: string;
  readonly developerPromptVersion?: string;
  readonly developerPromptHash?: string;
}>;

export function hashAllowedPathGlobs(globs: readonly string[] | undefined): string {
  return (globs ?? [])
    .map((g) => g.trim())
    .filter(Boolean)
    .sort()
    .join("|");
}

export function buildDeveloperPromptMeta(input: {
  readonly developerPrompt: string;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly targetRepoFullName: string;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly generatedAt: string;
}): CodeTaskDeveloperPromptMeta {
  return {
    promptContextUpdatedAt: input.promptContext?.updatedAt,
    targetRepoFullName: input.targetRepoFullName.trim(),
    baseBranch: input.baseBranch.trim(),
    allowedPathHash: hashAllowedPathGlobs(input.allowedPathGlobs),
    generatedAt: input.generatedAt,
    developerPromptVersion: CODE_TASK_DEVELOPER_PROMPT_VERSION,
    developerPromptHash: formatDeveloperPromptHashSha256(input.developerPrompt),
  };
}

export function parseCodeTaskDeveloperPromptMeta(raw: unknown): CodeTaskDeveloperPromptMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const generatedAt = String(o.generatedAt ?? "").trim();
  if (!generatedAt) return undefined;
  return {
    promptContextUpdatedAt: String(o.promptContextUpdatedAt ?? "").trim() || undefined,
    targetRepoFullName: String(o.targetRepoFullName ?? "").trim() || undefined,
    baseBranch: String(o.baseBranch ?? "").trim() || undefined,
    allowedPathHash: String(o.allowedPathHash ?? "").trim() || undefined,
    generatedAt,
    developerPromptVersion: String(o.developerPromptVersion ?? "").trim() || undefined,
    developerPromptHash: String(o.developerPromptHash ?? "").trim() || undefined,
  };
}

export function shouldReuseStoredDeveloperPrompt(input: {
  readonly run: CodeTaskExecutionRunV1;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
  readonly targetRepoFullName: string;
  readonly baseBranch: string;
  readonly allowedPathGlobs?: readonly string[];
  readonly developerPromptAugmentation?: CodeTaskDeveloperPromptAugmentation | null;
}): boolean {
  const stored = input.run.developerPrompt?.trim();
  if (!stored) return false;
  if (developerPromptContainsPlatformTrackingSections(stored)) return false;
  if (
    storedDeveloperPromptMissingAugmentation({
      storedPrompt: stored,
      augmentation: input.developerPromptAugmentation,
    })
  ) {
    return false;
  }

  const meta = parseCodeTaskDeveloperPromptMeta(
    (input.run as CodeTaskExecutionRunV1 & { developerPromptMeta?: unknown }).developerPromptMeta,
  );
  if (!meta) return false;

  const ctxUpdated = input.promptContext?.updatedAt?.trim();
  if (ctxUpdated && meta.promptContextUpdatedAt && ctxUpdated > meta.promptContextUpdatedAt) {
    return false;
  }

  if (meta.targetRepoFullName && meta.targetRepoFullName !== input.targetRepoFullName.trim()) {
    return false;
  }
  if (meta.baseBranch && meta.baseBranch !== input.baseBranch.trim()) {
    return false;
  }

  const pathHash = hashAllowedPathGlobs(input.allowedPathGlobs);
  if (meta.allowedPathHash && pathHash && meta.allowedPathHash !== pathHash) {
    return false;
  }

  const allowedPathGlobs = resolveEffectiveAllowedPathGlobs({
    allowedPathGlobs: input.allowedPathGlobs,
    targetRepoFullName: input.targetRepoFullName,
    targetRepoKind: "generated_project",
  });
  const safety = validateCodeTaskDeveloperPromptSafety({
    prompt: stored,
    targetRepoFullName: input.targetRepoFullName,
    targetRepoKind: "generated_project",
    allowedPathGlobs,
  });
  return safety.ok;
}
