import { DOCLING_RETRIEVAL_WARNING_OPENS_DISTRIBUTION } from "@/lib/docling-knowledge/docling-knowledge-eval";
import type { DoclingKnowledgeStageId } from "@/lib/docling-knowledge/docling-knowledge-stages";

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

/**
 * Data-structure completion: STRUCTURE (+ advisory PASS allowed) + KU + Chunk.
 * Does not require SEARCH_INDEX / RETRIEVAL_EVALUATION.
 */
export function isStructureStagesPassed(input: StructurePassInput): boolean {
  if (!input.pipelineCurrent) return false;

  const structure = findStep(input.steps, "STRUCTURE_VALIDATING");
  const knowledge = findStep(input.steps, "KNOWLEDGE_CHECKING");
  const chunk = findStep(input.steps, "CHUNKING");

  if (structure?.status === "FAIL") return false;
  if (structure?.status !== "PASS" && structure?.status !== "WARNING") return false;
  if (knowledge?.status !== "PASS") return false;
  if (chunk?.status !== "PASS") return false;

  const chunkCount = chunkCountFromStep(chunk);
  // Older runs may omit chunkCount in details; PASS on CHUNKING is still accepted.
  if (chunk.details && "chunkCount" in chunk.details && chunkCount < 1) return false;

  return true;
}

/**
 * Search-foundation completion: Draft index + retrieval evaluation on current binding.
 */
export function isSearchFoundationStagesPassed(input: StructurePassInput): boolean {
  if (!input.pipelineCurrent) return false;
  if (!isStructureStagesPassed(input)) return false;

  const index = findStep(input.steps, "INDEXING");
  const evaluation = findStep(input.steps, "SEARCH_EVALUATING");

  if (index?.status !== "PASS") return false;
  if (evaluation?.status === "PASS") return true;
  if (
    DOCLING_RETRIEVAL_WARNING_OPENS_DISTRIBUTION &&
    evaluation?.status === "WARNING"
  ) {
    return true;
  }
  return false;
}

/**
 * Full knowledge pipeline gate historically used as `passed`.
 * Equals search-foundation readiness (structure + index + evaluation + ready step).
 */
export function isFullKnowledgePipelineStagesPassed(input: StructurePassInput): boolean {
  if (!isSearchFoundationStagesPassed(input)) return false;
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
