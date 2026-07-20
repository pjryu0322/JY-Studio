/**
 * Pure status / CTA / next-action policy for Docling knowledge pipeline UI.
 * No DB access — keeps provider messaging separate from execute orchestration.
 */
import type { DoclingKnowledgeStageId } from "@/lib/docling-knowledge/docling-knowledge-stages";

export const BINDING_FAILURE_CODES = new Set([
  "DOCLING_BUNDLE_NOT_READY",
  "DOCLING_BUNDLE_MISMATCH",
  "NORMALIZED_DOCUMENT_MISMATCH",
  "FINGERPRINT_MISMATCH",
]);

export const BINDING_FAILURE_USER_MESSAGE =
  "등록 자료 상태가 변경되어 지식 데이터를 다시 생성할 수 없습니다. 자료 등록 상태를 새로고침한 뒤 다시 시도해 주세요.";

const PRIOR_FAIL_WAIT_BY_STAGE: Partial<Record<DoclingKnowledgeStageId, string>> = {
  KNOWLEDGE_UNIT: "문서 구조 확인을 통과해야 지식 단위 생성이 진행됩니다.",
  RETRIEVAL_CHUNK: "지식 단위 생성이 완료되어야 Retrieval Chunk 생성이 진행됩니다.",
  SEARCH_INDEX: "Retrieval Chunk 생성이 완료되어야 Draft 검색 인덱스 준비가 진행됩니다.",
  RETRIEVAL_EVALUATION: "Draft 검색 인덱스 준비가 완료되어야 검색 결과 검증이 진행됩니다.",
};

export type DoclingKnowledgeStageView = {
  id: DoclingKnowledgeStageId;
  label: string;
  description: string;
  pipelineStep: string;
  status: string;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  details: Record<string, unknown> | null;
  nextAction: string | null;
};

export type DoclingKnowledgePipelineStatusDto = {
  packId: string;
  enabled: boolean;
  providerConfirmed: boolean;
  pipelineStatus: string | null;
  runId: string | null;
  runStatus: string | null;
  fingerprint: string | null;
  stale: boolean;
  /**
   * Full knowledge pipeline pass (structure + search foundation + READY_FOR_REVIEW).
   * Prefer structurePassed / searchFoundationPassed for registration locks.
   * @deprecated for UI lock calculation — kept for Public/compat consumers.
   */
  passed: boolean;
  /** STRUCTURE + KNOWLEDGE_UNIT + RETRIEVAL_CHUNK on current binding. */
  structurePassed: boolean;
  /** SEARCH_INDEX + RETRIEVAL_EVALUATION on current binding. */
  searchFoundationPassed: boolean;
  /** Pack·Version·Bundle·NormalizedDocument·Fingerprint binding matches active materials. */
  pipelineCurrent: boolean;
  stages: DoclingKnowledgeStageView[];
  canStart: boolean;
  canRetry: boolean;
  canOpenDistribution: boolean;
  primaryCta:
    | "start"
    | "retry"
    | "distribution"
    | "warning_retry"
    | "search_validation"
    | "none";
  lockReason: string | null;
  summary: string | null;
};

export function resolveDoclingKnowledgeStageNextAction(input: {
  stageId: DoclingKnowledgeStageId;
  status: string;
  providerConfirmed: boolean;
  running: boolean;
  priorFailed: boolean;
  failureCode?: string | null;
}): string | null {
  const { stageId, status, providerConfirmed, running, priorFailed, failureCode } = input;
  if (status === "FAIL") {
    if (stageId === "STRUCTURE" && failureCode && BINDING_FAILURE_CODES.has(failureCode)) {
      return "자료 등록 상태를 새로고침한 뒤 다시 시도해 주세요.";
    }
    if (stageId === "STRUCTURE") {
      return "표시된 구조 문제를 확인한 뒤 파일을 교체하거나 다시 처리해 주세요.";
    }
    if (stageId === "RETRIEVAL_EVALUATION") {
      return "미통과 질문을 확인한 뒤 검색 데이터를 다시 생성하거나 재검증해 주세요.";
    }
    return "실패 원인을 확인한 뒤 해당 단계부터 다시 실행해 주세요.";
  }
  if (status === "STALE") {
    return "원본 또는 정규화 결과가 변경되었습니다. 지식 데이터를 다시 생성해 주세요.";
  }
  if (status === "SKIPPED") {
    return "지식 데이터를 다시 생성해 주세요.";
  }
  if (status === "PENDING") {
    if (priorFailed) {
      return PRIOR_FAIL_WAIT_BY_STAGE[stageId] ?? "선행 단계 실패로 대기 중입니다.";
    }
    if (running) {
      return "선행 단계가 완료되면 자동으로 진행됩니다.";
    }
    if (providerConfirmed) {
      return "지식 데이터 생성을 시작해 주세요.";
    }
  }
  return null;
}

/** Pure: provider lock copy for registration UI. */
export function resolveDoclingKnowledgeLockReason(input: {
  providerConfirmed: boolean;
  structurePassed: boolean;
  searchFoundationPassed: boolean;
}): string | null {
  if (!input.providerConfirmed) {
    return "자료 등록에서 대표 샘플 확인을 완료해야 지식 데이터를 시작할 수 있습니다.";
  }
  if (!input.structurePassed) {
    return "데이터 구조화(구조·Knowledge Unit·Chunk)가 완료되어야 검색 검증을 진행할 수 있습니다.";
  }
  if (!input.searchFoundationPassed) {
    return "검색 인덱스·검색 평가가 완료되어야 유통정보를 입력할 수 있습니다.";
  }
  return null;
}

/** Pure: primary CTA for knowledge pipeline status surface. */
export function resolveDoclingKnowledgePrimaryCta(input: {
  running: boolean;
  passed: boolean;
  structurePassed: boolean;
  searchFoundationPassed: boolean;
  stale: boolean;
  failed: boolean;
  warningOnly: boolean;
  providerConfirmed: boolean;
  packIsDraft: boolean;
}): DoclingKnowledgePipelineStatusDto["primaryCta"] {
  if (input.running) return "none";
  if (input.passed) return "distribution";
  if (input.structurePassed && !input.searchFoundationPassed && !input.stale && !input.failed) {
    return "search_validation";
  }
  if (input.warningOnly) return "warning_retry";
  if (input.failed || input.stale) return "retry";
  if (input.providerConfirmed && input.packIsDraft) return "start";
  return "none";
}

export function resolveDoclingKnowledgeActionFlags(input: {
  providerConfirmed: boolean;
  packIsDraft: boolean;
  running: boolean;
  passed: boolean;
  primaryCta: DoclingKnowledgePipelineStatusDto["primaryCta"];
}): Pick<
  DoclingKnowledgePipelineStatusDto,
  "canStart" | "canRetry" | "canOpenDistribution"
> {
  return {
    canStart:
      input.providerConfirmed &&
      input.packIsDraft &&
      !input.running &&
      input.primaryCta === "start",
    canRetry:
      input.providerConfirmed &&
      input.packIsDraft &&
      !input.running &&
      (input.primaryCta === "retry" || input.primaryCta === "warning_retry"),
    canOpenDistribution: input.passed && input.packIsDraft,
  };
}
