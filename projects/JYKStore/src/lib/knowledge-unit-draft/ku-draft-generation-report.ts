import type { KuDocumentProcessingStatus } from "./ku-draft-processing-status";
import type { KuDocumentSkipReasonCode } from "./ku-draft-skip-reasons";

export const AUTO_KU_GENERATION_REPORT_CHUNK_TYPE = "AUTO_KU_GENERATION_REPORT";

export type KuGenerationDocumentOutcome = {
  sourceDocumentId: string;
  status: KuDocumentProcessingStatus;
  reasonCode?: KuDocumentSkipReasonCode | "DRAFT_PERSIST_FAILED" | "SOURCE_DOCUMENT_NOT_FOUND";
  reason?: string;
  generatedUnitTitles: string[];
  duplicateOfChunkId?: string;
  steps: string[];
};

export type KuGenerationReportPayload = {
  versionId: string;
  generatedAt: string;
  generationScope: string;
  isPreviewGeneration: boolean;
  documents: KuGenerationDocumentOutcome[];
};

export function parseKuGenerationReportContent(content: string | null | undefined): KuGenerationReportPayload | null {
  if (!content?.trim()) return null;
  try {
    const parsed = JSON.parse(content) as KuGenerationReportPayload;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.documents)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeKuGenerationReport(payload: KuGenerationReportPayload): string {
  return JSON.stringify(payload);
}

export function kuGenerationReportToDocumentMap(
  report: KuGenerationReportPayload | null,
): Map<string, KuGenerationDocumentOutcome> {
  const map = new Map<string, KuGenerationDocumentOutcome>();
  if (!report) return map;
  for (const doc of report.documents) {
    map.set(doc.sourceDocumentId, doc);
  }
  return map;
}
