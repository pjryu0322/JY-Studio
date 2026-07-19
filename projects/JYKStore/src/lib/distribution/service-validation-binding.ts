import type { Prisma } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  parseKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";

export type CurrentValidationBinding = {
  pipelineRunId: string;
  packId: string;
  versionId: string;
  bundleId: string;
  indexGenerationId: string;
  normalizedDocumentId: string;
  fingerprint: string;
};

type TxClient = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

function staleError(): PayloadServiceError {
  return new PayloadServiceError(
    "SERVICE_VALIDATION_STALE",
    "지식 데이터가 변경되어 다운로드 검증을 다시 실행해야 합니다.",
    400,
  );
}

function toCurrentBinding(
  pipelineRunId: string,
  packId: string,
  binding: KnowledgeRunBinding,
): CurrentValidationBinding {
  return {
    pipelineRunId,
    packId,
    versionId: binding.versionId,
    bundleId: binding.bundleId,
    indexGenerationId: binding.indexGenerationId,
    normalizedDocumentId: binding.normalizedDocumentId,
    fingerprint: binding.fingerprint,
  };
}

export type ValidationBindingState =
  | {
      status: "CURRENT";
      binding: CurrentValidationBinding;
      latest: { id: string; status: string };
    }
  | {
      status: "MISSING";
      binding: null;
      latest: null;
      reason: "NO_PIPELINE_RUN";
    }
  | {
      status: "NOT_READY";
      binding: null;
      latest: { id: string; status: string };
      reason: "LATEST_RUN_PENDING" | "LATEST_RUN_RUNNING";
    }
  | {
      status: "STALE";
      binding: null;
      latest: { id: string; status: string };
      reason:
        | "LATEST_RUN_NOT_PASS"
        | "LATEST_BINDING_MISSING"
        | "LATEST_VERSION_MISMATCH"
        | "ND_OR_BUNDLE_MISMATCH";
    };

export function staleErrorForBindingState(state: ValidationBindingState): PayloadServiceError {
  if (state.status === "CURRENT") {
    return staleError();
  }
  if (state.status === "NOT_READY") {
    return new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "데이터 구조화가 아직 진행 중입니다. 완료 후 다시 검증해 주세요.",
      409,
    );
  }
  if (state.status === "MISSING") {
    return new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "데이터 구조화 결과가 없습니다. 구조화를 먼저 완료해 주세요.",
      409,
    );
  }
  if (state.reason === "LATEST_RUN_NOT_PASS") {
    return new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "최신 데이터 구조화가 완료되지 않았습니다. 다시 확인해 주세요.",
      409,
    );
  }
  return new PayloadServiceError(
    "SERVICE_VALIDATION_STALE",
    "지식 데이터가 변경되어 서비스 검증을 다시 실행해야 합니다.",
    409,
  );
}

/**
 * Resolve CURRENT / MISSING / NOT_READY / STALE from the actual latest PipelineRun only.
 * Never falls back to an older PASS run.
 */
export async function resolveValidationBindingState(
  tx: TxClient,
  input: { packId: string; versionId: string },
): Promise<ValidationBindingState> {
  const latest = await tx.pipelineRun.findFirst({
    where: {
      packId: input.packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
    },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      packId: true,
      status: true,
      summary: true,
    },
  });

  if (!latest) {
    return {
      status: "MISSING",
      binding: null,
      latest: null,
      reason: "NO_PIPELINE_RUN",
    };
  }

  const latestRef = { id: latest.id, status: latest.status };

  if (latest.status === "PENDING") {
    return {
      status: "NOT_READY",
      binding: null,
      latest: latestRef,
      reason: "LATEST_RUN_PENDING",
    };
  }
  if (latest.status === "RUNNING") {
    return {
      status: "NOT_READY",
      binding: null,
      latest: latestRef,
      reason: "LATEST_RUN_RUNNING",
    };
  }

  if (latest.status !== "PASS") {
    return {
      status: "STALE",
      binding: null,
      latest: latestRef,
      reason: "LATEST_RUN_NOT_PASS",
    };
  }

  const parsed = parseKnowledgeRunBinding(latest.summary);
  if (!parsed) {
    return {
      status: "STALE",
      binding: null,
      latest: latestRef,
      reason: "LATEST_BINDING_MISSING",
    };
  }
  if (parsed.versionId !== input.versionId) {
    return {
      status: "STALE",
      binding: null,
      latest: latestRef,
      reason: "LATEST_VERSION_MISMATCH",
    };
  }

  const matched = toCurrentBinding(latest.id, latest.packId, parsed);
  const normalizedDocument = await tx.normalizedDocument.findFirst({
    where: {
      id: matched.normalizedDocumentId,
      packId: input.packId,
      versionId: input.versionId,
      bundleId: matched.bundleId,
      fingerprint: matched.fingerprint,
      isActive: true,
      bundle: {
        id: matched.bundleId,
        packId: input.packId,
        versionId: input.versionId,
        isActive: true,
        deletedAt: null,
        storageStatus: "ACTIVE",
        status: "REVIEW_READY",
      },
    },
    select: { id: true },
  });
  if (!normalizedDocument) {
    return {
      status: "STALE",
      binding: null,
      latest: latestRef,
      reason: "ND_OR_BUNDLE_MISMATCH",
    };
  }

  return {
    status: "CURRENT",
    binding: matched,
    latest: latestRef,
  };
}

/**
 * Resolve the current knowledge pipeline binding for a pack version.
 * Uses the actual latest PipelineRun only (no older PASS fallback).
 */
export async function resolveCurrentValidationBindingTx(
  tx: TxClient,
  input: {
    packId: string;
    versionId: string;
    expectedPipelineRunId?: string | null;
  },
): Promise<CurrentValidationBinding> {
  const state = await resolveValidationBindingState(tx, {
    packId: input.packId,
    versionId: input.versionId,
  });
  if (state.status !== "CURRENT") {
    throw staleErrorForBindingState(state);
  }
  if (
    input.expectedPipelineRunId &&
    input.expectedPipelineRunId.trim() &&
    state.binding.pipelineRunId !== input.expectedPipelineRunId
  ) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "데이터 구조화 실행 상태가 변경되었습니다. 다시 확인해 주세요.",
      409,
    );
  }
  return state.binding;
}

/** Load binding stored on a specific PipelineRun (historical evidence). */
export async function resolvePipelineRunBindingTx(
  tx: TxClient,
  pipelineRunId: string | null | undefined,
): Promise<CurrentValidationBinding | null> {
  if (!pipelineRunId?.trim()) return null;
  const run = await tx.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    select: { id: true, packId: true, summary: true },
  });
  if (!run) return null;
  const binding = parseKnowledgeRunBinding(run.summary);
  if (!binding) return null;
  return toCurrentBinding(run.id, run.packId, binding);
}

export function runMatchesBinding(
  run: {
    indexGenerationId?: string | null;
    fingerprint?: string | null;
    normalizedDocumentId?: string | null;
    pipelineRunId?: string | null;
  },
  binding: CurrentValidationBinding | null | undefined,
): boolean {
  if (!binding) return false;
  return (
    run.pipelineRunId === binding.pipelineRunId &&
    run.indexGenerationId === binding.indexGenerationId &&
    run.fingerprint === binding.fingerprint &&
    run.normalizedDocumentId === binding.normalizedDocumentId
  );
}

export function evidenceIntegrityForRun(
  run: {
    status: string;
    pipelineRunId?: string | null;
    indexGenerationId?: string | null;
    fingerprint?: string | null;
    normalizedDocumentId?: string | null;
    invalidatedAt?: Date | null;
  },
  runPipelineBinding: CurrentValidationBinding | null,
): "VALID" | "INVALID" {
  if (run.invalidatedAt) return "INVALID";
  if (run.status !== "PASS") return "VALID";
  if (!run.pipelineRunId || !runPipelineBinding) return "INVALID";
  if (runPipelineBinding.pipelineRunId !== run.pipelineRunId) return "INVALID";
  if (!runMatchesBinding(run, runPipelineBinding)) return "INVALID";
  return "VALID";
}
