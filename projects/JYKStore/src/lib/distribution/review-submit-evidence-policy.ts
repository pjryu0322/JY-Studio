import type { Prisma } from "@prisma/client";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";

/** Any Prisma client (root or interactive transaction). */
export type PrismaLike = Prisma.TransactionClient;

export class ReviewSubmitEvidenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReviewSubmitEvidenceError";
  }
}

export const PREPARATION_CHANNELS: ServiceChannel[] = ["API", "MCP", "DOWNLOAD"];

export const EVIDENCE_DRIFT_MESSAGE =
  "검수요청 증적이 현재 지식 데이터와 일치하지 않습니다. 다시 검증한 뒤 검수요청해 주세요.";

export const RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE =
  "RAG Export 다운로드 테스트 증적이 검증 결과와 일치하지 않습니다. 다시 검증·다운로드해 주세요.";

/**
 * Fail-closed RAG Export download evidence: only a non-empty `exportFingerprint`
 * may bind downloadTest.fileId. Never fall back to details.fileId or SOURCE_ORIGINAL.
 */
export function assertRagExportDownloadEvidenceBinding(input: {
  runDetails: Record<string, unknown> | null;
  downloadTestFileId: string;
}): void {
  if (input.runDetails?.downloadMode !== "RAG_EXPORT") {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE);
  }
  const exportFingerprint = input.runDetails.exportFingerprint;
  if (typeof exportFingerprint !== "string" || exportFingerprint.trim().length < 1) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE);
  }
  if (input.downloadTestFileId !== exportFingerprint) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE);
  }
}
