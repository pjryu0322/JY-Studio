import type { DoclingKnowledgeStageId } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";

/** Stages that complete the data-structure registration step. */
export const STRUCTURE_STAGE_IDS = [
  "STRUCTURE",
  "KNOWLEDGE_UNIT",
  "RETRIEVAL_CHUNK",
] as const satisfies readonly DoclingKnowledgeStageId[];

/** Stages that complete search-foundation preparation (before API/MCP/DOWNLOAD). */
export const SEARCH_FOUNDATION_STAGE_IDS = [
  "SEARCH_INDEX",
  "RETRIEVAL_EVALUATION",
] as const satisfies readonly DoclingKnowledgeStageId[];

export type PipelineStepLike = {
  step: string;
  status: string;
  details?: Record<string, unknown> | null;
};

export type StructurePassInput = {
  steps: readonly PipelineStepLike[];
  /** When false, structure/search foundation cannot be CURRENT. */
  pipelineCurrent: boolean;
};

function findStep(steps: readonly PipelineStepLike[], pipelineStep: string) {
  return steps.find((s) => s.step === pipelineStep) ?? null;
}

function chunkCountFromStep(step: PipelineStepLike | null): number {
  if (!step?.details) return 0;
  const raw =
    step.details.chunkCount ??
    step.details.retrievalChunkCount ??
    step.details.chunks;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function blockerCountFromDetails(details: Record<string, unknown> | null | undefined): number {
  if (!details) return 0;
  if (typeof details.blockerCount === "number" && Number.isFinite(details.blockerCount)) {
    return details.blockerCount;
  }
  if (Array.isArray(details.blockers)) {
    return details.blockers.length;
  }
  return 0;
}

/**
 * STRUCTURE step counts as pass only for advisory warnings without blockers.
 * Plain WARNING without advisory does not pass structure readiness.
 */
export function isAdvisoryStructurePass(
  status: string,
  details?: Record<string, unknown> | null,
): boolean {
  if (status === "FAIL" || status === "STALE" || status === "SKIPPED") return false;
  const blockers = blockerCountFromDetails(details ?? null);
  if (blockers > 0) return false;

  if (status === "PASS") {
    return true;
  }
  if (status === "WARNING") {
    return details?.advisory === true;
  }
  return false;
}

/**
 * Data-structure completion: STRUCTURE (advisory rules) + KU + Chunk.
 */
export function isStructureStagesPassed(input: StructurePassInput): boolean {
  if (!input.pipelineCurrent) return false;

  const structure = findStep(input.steps, "STRUCTURE_VALIDATING");
  const knowledge = findStep(input.steps, "KNOWLEDGE_CHECKING");
  const chunk = findStep(input.steps, "CHUNKING");

  if (!isAdvisoryStructurePass(structure?.status ?? "PENDING", structure?.details)) {
    return false;
  }
  if (knowledge?.status !== "PASS") return false;
  if (chunk?.status !== "PASS") return false;

  const chunkCount = chunkCountFromStep(chunk);
  if (chunk.details && "chunkCount" in chunk.details && chunkCount < 1) return false;

  // Token Gate must be PASS (WARNING/FAIL block structure completion and claim).
  if (chunk.details) {
    if (
      chunk.details.tokenGateStatus === "FAIL" ||
      chunk.details.tokenGateStatus === "WARNING" ||
      (typeof chunk.details.hardLimitExceededCount === "number" &&
        chunk.details.hardLimitExceededCount > 0) ||
      (typeof chunk.details.targetExceededCount === "number" &&
        chunk.details.targetExceededCount > 0)
    ) {
      return false;
    }
    if (
      "tokenGateStatus" in chunk.details &&
      chunk.details.tokenGateStatus != null &&
      chunk.details.tokenGateStatus !== "PASS"
    ) {
      return false;
    }
  }

  return true;
}

/** Strict: SEARCH_INDEX + RETRIEVAL_EVALUATION must be PASS (no WARNING) with current ranking policy. */
export function isSearchFoundationStagesPassedStrict(
  input: StructurePassInput & {
    expectedRankingPolicyVersion?: string;
  },
): boolean {
  if (!input.pipelineCurrent) return false;
  if (!isStructureStagesPassed(input)) return false;

  const index = findStep(input.steps, "INDEXING");
  const evaluation = findStep(input.steps, "SEARCH_EVALUATING");

  if (index?.status !== "PASS") return false;
  if (evaluation?.status !== "PASS") return false;

  const expected =
    input.expectedRankingPolicyVersion?.trim() || RETRIEVAL_RANKING_POLICY_VERSION;
  const stored = evaluation.details?.retrievalRankingPolicyVersion;
  return typeof stored === "string" && stored.trim() === expected;
}

/**
 * @deprecated Prefer isSearchFoundationStagesPassedStrict for submit/readiness.
 * Kept as alias for strict policy.
 */
export function isSearchFoundationStagesPassed(input: StructurePassInput): boolean {
  return isSearchFoundationStagesPassedStrict(input);
}

/**
 * Full knowledge pipeline gate (historical `passed`).
 */
export function isFullKnowledgePipelineStagesPassed(input: StructurePassInput): boolean {
  if (!isSearchFoundationStagesPassedStrict(input)) return false;
  const ready = findStep(input.steps, "READY_FOR_REVIEW");
  return ready?.status === "PASS";
}

export function filterStagesByIds<T extends { id: string }>(
  stages: readonly T[],
  ids: readonly DoclingKnowledgeStageId[],
): T[] {
  const allowed = new Set<string>(ids);
  return stages.filter((s) => allowed.has(s.id));
}
