import { SOURCE_DOCUMENT_MIN_CONTENT_LENGTH } from "@/lib/github-auto-collect/github-knowledge-unit-draft-options";
import { extractGitHubPathFromSourceUrl } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import type { KuDocumentProcessingStatus } from "./ku-draft-processing-status";

export type KuDocumentSkipReasonCode =
  | "METADATA_FILE"
  | "LOCK_FILE"
  | "LICENSE_FILE"
  | "CHANGELOG_FILE"
  | "CONTRIBUTING_FILE"
  | "EMPTY_CONTENT"
  | "CONTENT_TOO_SHORT"
  | "NON_GITHUB_SOURCE"
  | "SOURCE_URL_REQUIRED"
  | "VALIDATION_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "NO_KNOWLEDGE_TOPIC"
  | "NOT_SELECTED_IN_PREVIEW"
  | "NOT_IN_GENERATION_SCOPE"
  | "DUPLICATE";

export const KU_SKIP_REASON_LABELS: Record<KuDocumentSkipReasonCode, string> = {
  METADATA_FILE: "패키지/메타데이터 파일",
  LOCK_FILE: "의존성 잠금 파일",
  LICENSE_FILE: "라이선스 문서",
  CHANGELOG_FILE: "변경 이력 문서",
  CONTRIBUTING_FILE: "기여 가이드 문서",
  EMPTY_CONTENT: "본문이 비어 있음",
  CONTENT_TOO_SHORT: "본문이 너무 짧음",
  NON_GITHUB_SOURCE: "GitHub 원천 문서가 아님",
  SOURCE_URL_REQUIRED: "원천 URL이 없음",
  VALIDATION_FAILED: "원천 문서 검증 실패",
  UNSUPPORTED_FORMAT: "현재 지원하지 않는 문서 형식",
  NO_KNOWLEDGE_TOPIC: "추출 가능한 제품 지식 주제를 찾지 못함",
  NOT_SELECTED_IN_PREVIEW: "미리보기 생성 범위에서 제외됨",
  NOT_IN_GENERATION_SCOPE: "이번 생성 범위에 포함되지 않음",
  DUPLICATE: "기존 Knowledge Unit과 중복",
};

const UNSUPPORTED_REASON_CODES = new Set<KuDocumentSkipReasonCode>([
  "NON_GITHUB_SOURCE",
  "SOURCE_URL_REQUIRED",
  "UNSUPPORTED_FORMAT",
]);

export type SourceDocForKuClassification = {
  id: string;
  title: string;
  sourceUrl: string | null;
  fileName: string | null;
  content: string | null;
  validationStatus: string;
  validationSummary: string | null;
  sourceFormat?: string;
  mimeType?: string | null;
};

export function kuSkipReasonToStatus(reasonCode: KuDocumentSkipReasonCode): "excluded" | "unsupported" {
  return UNSUPPORTED_REASON_CODES.has(reasonCode) ? "unsupported" : "excluded";
}

export function labelForKuSkipReasonCode(code: KuDocumentSkipReasonCode): string {
  return KU_SKIP_REASON_LABELS[code];
}

function docPath(doc: SourceDocForKuClassification): string {
  return (
    extractGitHubPathFromSourceUrl(doc.sourceUrl) ??
    doc.fileName?.replace(/\\/g, "/") ??
    doc.title
  );
}

function isUnsupportedAssetPath(norm: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|zip|tar|gz)$/i.test(norm);
}

function isLicensePath(norm: string): boolean {
  return (
    norm === "license" ||
    norm === "license.md" ||
    norm === "license.txt" ||
    norm.endsWith("/license") ||
    /^license(\.|$)/i.test(norm.split("/").pop() ?? "")
  );
}

function isChangelogPath(norm: string): boolean {
  const base = norm.split("/").pop() ?? norm;
  return /^changelog(\.|$)/i.test(base) || base === "history.md";
}

function isContributingPath(norm: string): boolean {
  const base = norm.split("/").pop() ?? norm;
  return /^contributing(\.|$)/i.test(base) || base === "code_of_conduct.md";
}

export function classifySourceDocumentForKuGeneration(
  doc: SourceDocForKuClassification,
): { reasonCode: KuDocumentSkipReasonCode; status: "excluded" | "unsupported" } | null {
  const path = docPath(doc);
  const norm = path.toLowerCase();

  if (!doc.content?.trim()) {
    return { reasonCode: "EMPTY_CONTENT", status: "excluded" };
  }
  if (!doc.sourceUrl?.trim()) {
    return { reasonCode: "SOURCE_URL_REQUIRED", status: "unsupported" };
  }
  if (!doc.sourceUrl.startsWith("https://github.com/")) {
    return { reasonCode: "NON_GITHUB_SOURCE", status: "unsupported" };
  }
  if (doc.validationStatus === "FAIL") {
    return { reasonCode: "VALIDATION_FAILED", status: "excluded" };
  }
  if (doc.content.trim().length < SOURCE_DOCUMENT_MIN_CONTENT_LENGTH) {
    return { reasonCode: "CONTENT_TOO_SHORT", status: "excluded" };
  }
  if (norm.endsWith("package.json")) {
    return { reasonCode: "METADATA_FILE", status: "excluded" };
  }
  if (norm.endsWith("package-lock.json") || norm.endsWith("yarn.lock") || norm.endsWith("pnpm-lock.yaml")) {
    return { reasonCode: "LOCK_FILE", status: "excluded" };
  }
  if (isLicensePath(norm)) {
    return { reasonCode: "LICENSE_FILE", status: "excluded" };
  }
  if (isChangelogPath(norm)) {
    return { reasonCode: "CHANGELOG_FILE", status: "excluded" };
  }
  if (isContributingPath(norm)) {
    return { reasonCode: "CONTRIBUTING_FILE", status: "excluded" };
  }
  if (isUnsupportedAssetPath(norm)) {
    return { reasonCode: "UNSUPPORTED_FORMAT", status: "unsupported" };
  }

  const isCodePath = /\.(ts|tsx|js|jsx|java|go|rs|cs|cpp|c|h|swift|kt)$/i.test(norm);
  const isMarkdown = /\.(md|mdx)$/i.test(norm) || doc.sourceFormat === "MARKDOWN";
  if (isCodePath && !isMarkdown && doc.sourceFormat !== "CODE" && doc.sourceFormat !== "SAMPLE_CODE") {
    return {
      reasonCode: "UNSUPPORTED_FORMAT",
      status: "unsupported",
    };
  }

  return null;
}

export function mapServiceSkipReasonToCode(reason: string): KuDocumentSkipReasonCode {
  const table: Record<string, KuDocumentSkipReasonCode> = {
    CONTENT_REQUIRED: "EMPTY_CONTENT",
    SOURCE_URL_REQUIRED: "SOURCE_URL_REQUIRED",
    NON_GITHUB_SOURCE: "NON_GITHUB_SOURCE",
    SOURCE_VALIDATION_FAILED: "VALIDATION_FAILED",
    CONTENT_TOO_SHORT: "CONTENT_TOO_SHORT",
    METADATA_FILE: "METADATA_FILE",
    LOCK_FILE: "LOCK_FILE",
  };
  return table[reason] ?? "VALIDATION_FAILED";
}

export function normalizeKuDocumentProcessingStatus(
  status: string,
): KuDocumentProcessingStatus {
  if (status === "deduped") return "duplicate";
  if (
    status === "generated" ||
    status === "duplicate" ||
    status === "excluded" ||
    status === "unsupported" ||
    status === "failed"
  ) {
    return status;
  }
  return "excluded";
}
