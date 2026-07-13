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
    default:
      return fallback?.trim() || "Docling import 처리에 실패했습니다.";
  }
}

export function formatDoclingStorageStatus(status: string | null | undefined): string {
  switch (status) {
    case "ACTIVE":
      return "저장소 활성";
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
