/**
 * Pure policy checks for commitSuccessfulDownloadTestEvidence transaction.
 * Keep RAG Export fail-closed: exportFingerprint must equal input.fileId.
 */
import { PackStatus } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { CurrentValidationBinding } from "@/lib/distribution/service-validation-binding";

export function assertDownloadCommitPackEditable(pack: {
  packId: string;
  status: PackStatus;
} | null): asserts pack is { packId: string; status: PackStatus } {
  if (!pack) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청 전 초안 상태에서만 테스트 다운로드를 실행할 수 있습니다.",
      403,
    );
  }
}

export function assertDownloadCommitRunEligible(input: {
  run: {
    packId: string;
    versionId: string;
    channel: string;
    status: string;
    invalidatedAt: Date | null;
    pipelineRunId: string | null;
    confirmation: unknown;
  } | null;
  packId: string;
  versionId: string;
}): asserts input is {
  run: {
    packId: string;
    versionId: string;
    channel: string;
    status: string;
    invalidatedAt: Date | null;
    pipelineRunId: string;
    confirmation: unknown;
  };
  packId: string;
  versionId: string;
} {
  const { run } = input;
  if (
    !run ||
    run.packId !== input.packId ||
    run.versionId !== input.versionId ||
    run.channel !== "DOWNLOAD"
  ) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  if (run.confirmation) {
    throw new PayloadServiceError(
      "SERVICE_CONFIRMATION_ALREADY_RECORDED",
      "품질 확인이 기록된 뒤에는 테스트 다운로드 증적을 변경할 수 없습니다.",
      403,
    );
  }
  if (run.status !== "PASS" || run.invalidatedAt) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_REQUIRED",
      "다운로드 검증이 완료된 실행에서만 테스트 다운로드할 수 있습니다.",
      400,
    );
  }
  if (!run.pipelineRunId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터가 변경되어 다운로드 검증을 다시 실행해야 합니다.",
      400,
    );
  }
}

export function assertDownloadCommitBindingMatches(input: {
  run: {
    indexGenerationId: string | null;
    fingerprint: string | null;
    normalizedDocumentId: string | null;
  };
  binding: CurrentValidationBinding;
}): void {
  if (
    input.run.indexGenerationId !== input.binding.indexGenerationId ||
    input.run.fingerprint !== input.binding.fingerprint ||
    input.run.normalizedDocumentId !== input.binding.normalizedDocumentId
  ) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터가 변경되어 다운로드 검증을 다시 실행해야 합니다.",
      400,
    );
  }
}

/** Fail-closed: details.fileId must equal input.fileId; RAG_EXPORT also requires exportFingerprint. */
export function assertDownloadCommitFileEvidenceMatches(input: {
  details: Record<string, unknown> | null;
  fileId: string;
}): { isRagExport: boolean } {
  const detailsFileId =
    typeof input.details?.fileId === "string" ? input.details.fileId : null;
  if (!detailsFileId || detailsFileId !== input.fileId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "다운로드 검증 증적의 원본파일이 일치하지 않습니다. 다시 검증해 주세요.",
      400,
    );
  }
  const isRagExport = input.details?.downloadMode === "RAG_EXPORT";
  if (isRagExport) {
    const exportFp =
      typeof input.details?.exportFingerprint === "string"
        ? input.details.exportFingerprint
        : null;
    if (!exportFp || exportFp !== input.fileId) {
      throw new PayloadServiceError(
        "RAG_EXPORT_FINGERPRINT_MISMATCH",
        "RAG Export 검증 증적이 올바르지 않습니다. 다시 검증해 주세요.",
        400,
      );
    }
  }
  return { isRagExport };
}

export function resolveExistingDownloadTestEvidence(input: {
  downloadTest: { responseReady: boolean; fileId: string; testedAt: Date } | null | undefined;
  fileId: string;
}): { fileId: string; testedAt: string; created: false } | null {
  if (!input.downloadTest?.responseReady) return null;
  if (input.downloadTest.fileId !== input.fileId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "기존 다운로드 테스트 증적의 원본파일이 일치하지 않습니다.",
      400,
    );
  }
  return {
    fileId: input.downloadTest.fileId,
    testedAt: input.downloadTest.testedAt.toISOString(),
    created: false,
  };
}

export function assertPersistedDownloadTestEvidence(input: {
  evidence: { responseReady: boolean; fileId: string; testedAt: Date } | null;
  fileId: string;
  created: boolean;
}): { fileId: string; testedAt: string; created: boolean } {
  if (!input.evidence?.responseReady) {
    throw new PayloadServiceError(
      "SERVICE_DOWNLOAD_TEST_REQUIRED",
      "다운로드 테스트 증적을 저장하지 못했습니다. 다시 시도해 주세요.",
      500,
    );
  }
  if (input.evidence.fileId !== input.fileId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "기존 다운로드 테스트 증적의 원본파일이 일치하지 않습니다.",
      400,
    );
  }
  return {
    fileId: input.evidence.fileId,
    testedAt: input.evidence.testedAt.toISOString(),
    created: input.created,
  };
}
