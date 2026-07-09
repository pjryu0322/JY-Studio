import {
  GitHubDiscoveryError,
  type GitHubKnowledgeUnitDraftInput,
  type GitHubKnowledgeUnitGenerationMode,
} from "./github-auto-collect-types";

export const KNOWLEDGE_UNIT_DRAFT_HARD_CAP = 50;
export const SOURCE_DOCUMENT_MIN_CONTENT_LENGTH = 50;

const GENERATION_MODES = new Set<GitHubKnowledgeUnitGenerationMode>([
  "MINIMAL",
  "STANDARD",
  "FULL",
  "CUSTOM",
]);

const MODE_PRESETS: Record<
  Exclude<GitHubKnowledgeUnitGenerationMode, "CUSTOM">,
  { target: number; max: number }
> = {
  MINIMAL: { target: 8, max: 10 },
  STANDARD: { target: 15, max: 25 },
  FULL: { target: 30, max: 50 },
};

export type NormalizedGitHubKnowledgeUnitDraftInput = {
  sourceDocumentIds: string[];
  sourceDocumentPaths: string[];
  generationMode: GitHubKnowledgeUnitGenerationMode;
  targetKnowledgeUnitCount: number;
  minKnowledgeUnitCount: number;
  maxKnowledgeUnitCount: number;
  productProfileType?: GitHubKnowledgeUnitDraftInput["productProfileType"];
  overwriteExistingDrafts: boolean;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeGitHubKnowledgeUnitDraftInput(
  input: GitHubKnowledgeUnitDraftInput,
  warnings: string[],
): NormalizedGitHubKnowledgeUnitDraftInput {
  const generationMode = (input.generationMode ?? "MINIMAL") as GitHubKnowledgeUnitGenerationMode;
  if (!GENERATION_MODES.has(generationMode)) {
    throw new GitHubDiscoveryError(
      "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
      "generationMode가 올바르지 않습니다.",
      400,
    );
  }

  let targetKnowledgeUnitCount = input.targetKnowledgeUnitCount ?? 8;
  let maxKnowledgeUnitCount = input.maxKnowledgeUnitCount ?? 30;
  let minKnowledgeUnitCount = input.minKnowledgeUnitCount ?? 5;

  if (generationMode !== "CUSTOM") {
    const preset = MODE_PRESETS[generationMode];
    targetKnowledgeUnitCount = preset.target;
    maxKnowledgeUnitCount = preset.max;
    minKnowledgeUnitCount = Math.min(minKnowledgeUnitCount, preset.target);
  } else {
    targetKnowledgeUnitCount = clampInt(targetKnowledgeUnitCount, 1, KNOWLEDGE_UNIT_DRAFT_HARD_CAP);
    maxKnowledgeUnitCount = clampInt(
      maxKnowledgeUnitCount,
      1,
      KNOWLEDGE_UNIT_DRAFT_HARD_CAP,
    );
    minKnowledgeUnitCount = clampInt(minKnowledgeUnitCount, 1, KNOWLEDGE_UNIT_DRAFT_HARD_CAP);
  }

  maxKnowledgeUnitCount = Math.min(maxKnowledgeUnitCount, KNOWLEDGE_UNIT_DRAFT_HARD_CAP);
  targetKnowledgeUnitCount = Math.min(targetKnowledgeUnitCount, maxKnowledgeUnitCount);

  if (maxKnowledgeUnitCount < minKnowledgeUnitCount) {
    throw new GitHubDiscoveryError(
      "INVALID_KNOWLEDGE_UNIT_DRAFT_OPTIONS",
      "maxKnowledgeUnitCount는 minKnowledgeUnitCount보다 작을 수 없습니다.",
      400,
    );
  }

  const sourceDocumentIds = (input.sourceDocumentIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  const sourceDocumentPaths = (input.sourceDocumentPaths ?? [])
    .map((p) => p.trim().replace(/\\/g, "/").replace(/^\/+/, ""))
    .filter(Boolean);

  const overwriteExistingDrafts = input.overwriteExistingDrafts === true;
  if (overwriteExistingDrafts) {
    warnings.push(
      "overwriteExistingDrafts=true이면 기존 draft는 superseded 처리 후 새 draft를 생성합니다.",
    );
  }

  return {
    sourceDocumentIds,
    sourceDocumentPaths,
    generationMode,
    targetKnowledgeUnitCount,
    minKnowledgeUnitCount,
    maxKnowledgeUnitCount,
    productProfileType: input.productProfileType,
    overwriteExistingDrafts,
  };
}
