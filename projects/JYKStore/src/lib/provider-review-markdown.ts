import {
  formatProviderReviewQualityLabel,
  overallProviderReviewQualityLabel,
} from "@/lib/provider-review-workbench";
import type { ProviderReviewAreaGuidance, ProviderReviewIssueEvidence } from "@/lib/provider-review-evidence";

type SourceDoc = { title?: string | null; sourceFormat?: string | null; sourceType?: string | null };

export type ProviderReviewMarkdownChunkItem = {
  chunkId?: string | null;
  title?: string | null;
  locationLabel?: string | null;
  contentPreview?: string | null;
  issueReason?: string | null;
  serviceImpact?: string | null;
  providerAction?: string | null;
  reviewStatus?: string | null;
  /** @deprecated Prefer contentPreview / issueReason fields. */
  contentLength?: number | null;
};

export function buildProviderGenerationReviewMarkdown(input: {
  packId: string;
  packName: string;
  structureStatus?: string | null;
  chunkStatus?: string | null;
  retrievalStatus?: string | null;
  warningCount: number;
  failCount: number;
  checkedAt?: string | null;
  sourceDocuments: readonly SourceDoc[];
  chunkReviewItems?: readonly ProviderReviewMarkdownChunkItem[];
  /** @deprecated Use chunkReviewItems. Kept for older callers. */
  chunkSamples?: readonly ProviderReviewMarkdownChunkItem[];
  guidance: readonly ProviderReviewAreaGuidance[];
  issues: readonly ProviderReviewIssueEvidence[];
}): string {
  const overall = overallProviderReviewQualityLabel({
    structure: input.structureStatus,
    chunk: input.chunkStatus,
    retrieval: input.retrievalStatus,
  });
  const checked =
    input.checkedAt != null ? new Date(input.checkedAt).toLocaleString("ko-KR") : "—";
  const chunkItems =
    input.chunkReviewItems ??
    input.chunkSamples ??
    [];

  const lines: string[] = [
    `# 생성결과 내역`,
    ``,
    `## 요약`,
    ``,
    `| 항목 | 내용 |`,
    `| --- | --- |`,
    `| 지식팩 | ${escapeCell(input.packName)} (\`${input.packId}\`) |`,
    `| 품질 요약 | ${overall} |`,
    `| 구조화 | ${formatProviderReviewQualityLabel(input.structureStatus)} |`,
    `| 청킹 | ${formatProviderReviewQualityLabel(input.chunkStatus)} |`,
    `| 검색 평가 | ${formatProviderReviewQualityLabel(input.retrievalStatus)} |`,
    `| 주요 이슈 | 주의 ${input.warningCount}건 · 실패 ${input.failCount}건 |`,
    `| 품질 점검 시각 | ${checked} |`,
    ``,
  ];

  if (input.guidance.length > 0) {
    lines.push(`## 주의 필요 · 제공자 조치`, ``);
    lines.push(`| 영역 | 상태 | 문제 | 서비스 영향 | 제공자 조치 |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const row of input.guidance) {
      lines.push(
        `| ${escapeCell(row.areaLabel)} | ${escapeCell(row.statusLabel)} | ${escapeCell(row.problem)} | ${escapeCell(row.serviceImpact)} | ${escapeCell(row.providerAction)} |`,
      );
    }
    lines.push(``);
  }

  lines.push(`## 원본 파일`, ``);
  if (input.sourceDocuments.length === 0) {
    lines.push(`- (없음)`, ``);
  } else {
    lines.push(`| 순번 | 파일명 | 형식 |`);
    lines.push(`| --- | --- | --- |`);
    input.sourceDocuments.forEach((doc, idx) => {
      lines.push(
        `| ${idx + 1} | ${escapeCell(doc.title ?? "—")} | ${escapeCell(doc.sourceFormat || doc.sourceType || "—")} |`,
      );
    });
    lines.push(``);
  }

  lines.push(`## 지식단위/Chunk 검토 상세`, ``);
  if (chunkItems.length === 0) {
    lines.push(`- (없음)`, ``);
  } else {
    lines.push(
      `| Chunk ID | 원본 위치 | 제목/섹션 | 본문 미리보기 | 이슈 사유 | 서비스 영향 | 제공자 조치 | 검토 상태 |`,
    );
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
    for (const row of chunkItems) {
      lines.push(
        `| ${escapeCell(row.chunkId || "—")} | ${escapeCell(row.locationLabel || "—")} | ${escapeCell(row.title || "—")} | ${escapeCell(row.contentPreview || (typeof row.contentLength === "number" ? `${row.contentLength}자` : "—"))} | ${escapeCell(row.issueReason || "—")} | ${escapeCell(row.serviceImpact || "—")} | ${escapeCell(row.providerAction || "—")} | ${escapeCell(row.reviewStatus || "—")} |`,
      );
    }
    lines.push(``);
  }

  lines.push(`## 품질점검 이슈`, ``);
  if (input.issues.length === 0) {
    lines.push(`- 표시할 이슈가 없습니다.`, ``);
  } else {
    lines.push(
      `| 영역 | 유형 | 심각도 | 메시지 | 위치 | 대상 ID | 문제 데이터 | 조치 |`,
    );
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
    for (const issue of input.issues) {
      lines.push(
        `| ${escapeCell(areaKo(issue.area))} | ${escapeCell(issue.issueTypeLabel)} | ${escapeCell(issue.severityLabel)} | ${escapeCell(issue.message)} | ${escapeCell(issue.locationLabel || "—")} | ${escapeCell(issue.targetId || "—")} | ${escapeCell(issue.problemPreview || issue.evidenceGapReason || "—")} | ${escapeCell(issue.providerAction)} |`,
      );
    }
    lines.push(``);
  }

  return lines.join("\n");
}

function areaKo(area: ProviderReviewIssueEvidence["area"]): string {
  if (area === "structure") return "구조화";
  if (area === "chunk") return "청킹";
  return "검색 평가";
}

function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

export function downloadTextFile(filename: string, content: string, mime = "text/markdown;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
