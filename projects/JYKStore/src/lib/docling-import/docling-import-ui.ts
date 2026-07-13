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
