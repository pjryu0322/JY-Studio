import type { KnowledgePackFileRole } from "@prisma/client";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";

export const DOCLING_FILE_ROLE_LABELS: Record<KnowledgePackFileRole, string> = {
  SOURCE_ORIGINAL: "원본문서",
  DOCLING_JSON: "Docling JSON",
  DOCLING_MARKDOWN: "Docling Markdown",
};

export function truncateSha256(value: string, keep = 12): string {
  if (value.length <= keep * 2 + 1) return value;
  return `${value.slice(0, keep)}…${value.slice(-8)}`;
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size.toLocaleString()} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function isDoclingPayloadReady(status: string | null | undefined): boolean {
  return status === "REVIEW_READY";
}

export function isDoclingPayloadPresent(status: string | null | undefined): boolean {
  return status === "REVIEW_READY" || status === "NORMALIZED";
}

export function extractOriginMatchSummary(validationReport: unknown): string {
  if (!validationReport || typeof validationReport !== "object") return "—";
  const report = validationReport as Record<string, unknown>;
  const origin = report.originMatch;
  if (!origin || typeof origin !== "object") return "—";
  const match = origin as Record<string, unknown>;
  const filename = typeof match.filenameStatus === "string" ? match.filenameStatus : "?";
  const mime = typeof match.mimetypeStatus === "string" ? match.mimetypeStatus : "?";
  return `파일명 ${filename} · MIME ${mime}`;
}

export function extractSimilarityDiagnostics(validationReport: unknown): {
  validatorVersion: string | null;
  markdownCoverage: number | null;
  jaccard: number | null;
  samplePassCount: number | null;
} | null {
  if (!validationReport || typeof validationReport !== "object") return null;
  const report = validationReport as Record<string, unknown>;
  const metrics =
    report.metrics && typeof report.metrics === "object"
      ? (report.metrics as Record<string, unknown>)
      : null;
  const validatorVersion =
    typeof report.validatorVersion === "string"
      ? report.validatorVersion
      : null;
  const markdownCoverage =
    typeof report.markdownCoverage === "number"
      ? report.markdownCoverage
      : typeof metrics?.markdownCoverage === "number"
        ? metrics.markdownCoverage
        : null;
  const jaccard =
    typeof report.jaccard === "number"
      ? report.jaccard
      : typeof metrics?.jaccard === "number"
        ? metrics.jaccard
        : null;
  const samplePassCount =
    typeof report.samplePassCount === "number"
      ? report.samplePassCount
      : typeof metrics?.passedSampleCount === "number"
        ? metrics.passedSampleCount
        : null;
  if (
    validatorVersion == null &&
    markdownCoverage == null &&
    jaccard == null &&
    samplePassCount == null
  ) {
    return null;
  }
  return { validatorVersion, markdownCoverage, jaccard, samplePassCount };
}

export function fileByRole(
  bundle: DoclingImportBundlePublicDto,
  role: KnowledgePackFileRole,
) {
  return bundle.files.find((file) => file.role === role) ?? null;
}

export function mapDoclingImportUserError(code: string | null | undefined, fallback?: string): string {
  switch (code) {
    case "DOCLING_FILE_SIGNATURE_MISMATCH":
      return "파일 확장자와 실제 파일 형식이 일치하지 않습니다. Docling 원본문서를 다시 확인하세요.";
    case "DOCLING_MIME_MISMATCH":
      return "클라이언트 MIME 유형과 실제 파일 형식이 일치하지 않습니다.";
    case "DOCLING_FILE_CONTENT_INVALID":
      return "파일 내용이 올바르지 않습니다. Docling 원본문서를 다시 확인하세요.";
    case "DOCLING_HTML_CONTENT_INVALID":
      return "HTML 원본문서 형식이 올바르지 않습니다.";
    case "DOCLING_OFFICE_PACKAGE_INVALID":
      return "Office 문서 패키지가 올바르지 않습니다.";
    case "DOCLING_OFFICE_REQUIRED_ENTRY_MISSING":
      return "Office 문서에 필수 항목이 없습니다.";
    case "DOCLING_IMMUTABLE_AFTER_SUBMISSION":
      return "검수 제출 이력이 있어 교체할 수 없습니다. 새 버전을 생성하세요.";
    case "DOCLING_STAGING_BUNDLE_EXISTS":
      return "처리되지 않은 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 새 파일을 등록하세요.";
    case "DOCLING_BUNDLE_STORAGE_NOT_ACTIVE":
      return "삭제되었거나 저장소가 비활성인 Bundle은 재시도할 수 없습니다.";
    case "DOCLING_REVIEW_STATE_CONFLICT":
      return "검수 상태와 Bundle 상태가 충돌합니다. 새로고침 후 다시 시도하세요.";
    case "DOCLING_JSON_MARKDOWN_MISMATCH":
      return "JSON과 Markdown이 서로 다른 문서로 보입니다. 동일 Docling 출력 쌍인지 확인하세요.";
    case "DOCLING_JSON_MARKDOWN_INCONCLUSIVE":
      return "대용량 문서에서는 유사도만으로 단정할 수 없습니다. 저장된 파일 재검증을 시도해 보세요.";
    case "DOCLING_JSON_MARKDOWN_LOW_COVERAGE":
      return "Markdown이 JSON 텍스트를 부분적으로만 포함합니다. 동일 문서인지 확인하거나 재검증하세요.";
    case "DOCLING_REVALIDATION_NOT_ALLOWED":
      return "현재 상태에서는 저장된 파일 재검증을 할 수 없습니다.";
    case "DOCLING_VALIDATOR_VERSION_OUTDATED":
      return "검증기 버전이 갱신되었습니다. 저장된 파일 재검증을 실행하세요.";
    default:
      return fallback?.trim() || "Docling import 처리에 실패했습니다.";
  }
}

export function formatDoclingStorageStatus(status: string | null | undefined): string {
  switch (status) {
    case "ACTIVE":
      return "원본 저장 완료";
    case "DELETE_PENDING":
      return "삭제 대기";
    case "DELETED":
      return "삭제됨";
    case "DELETE_FAILED":
      return "삭제 실패";
    default:
      return status ?? "—";
  }
}

export function formatDoclingBundleStatus(status: string | null | undefined): string {
  switch (status) {
    case "REVIEW_READY":
      return "검수 준비 완료";
    case "NORMALIZED":
      return "문서 구조 변환 완료";
    case "NORMALIZING":
      return "문서 구조 변환 중";
    case "VALID":
      return "검증 완료";
    case "VALIDATING":
      return "검증 중";
    case "VALIDATION_FAILED":
      return "검증 실패";
    case "NORMALIZATION_FAILED":
      return "변환 실패";
    case "UPLOADED":
      return "업로드 완료";
    default:
      return status ?? "—";
  }
}

export function formatDoclingBundleStatusWithCode(status: string | null | undefined): string {
  const label = formatDoclingBundleStatus(status);
  if (!status || label === status) return label;
  return `${label} (${status})`;
}
