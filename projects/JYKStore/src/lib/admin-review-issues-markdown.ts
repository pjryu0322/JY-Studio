/**
 * Markdown export for Admin "주의 이슈" card — blockers/warnings with
 * per-document detail (not just aggregate counts).
 */
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  collectReviewBlockers,
  collectReviewWarnings,
} from "@/lib/admin-review-decision";
import { isLicenseLikeSourceDocument } from "@/lib/python-worker/worker-license-like";

type SourceDoc = AdminReviewDetailDto["versions"][number]["sourceDocuments"][number];

function escapeMd(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function listSourceWarningDocuments(detail: AdminReviewDetailDto): Array<{
  version: string;
  doc: SourceDoc;
}> {
  const rows: Array<{ version: string; doc: SourceDoc }> = [];
  for (const version of detail.versions) {
    for (const doc of version.sourceDocuments) {
      if (doc.validationStatus !== "WARNING") continue;
      if (isLicenseLikeSourceDocument({ title: doc.title })) continue;
      rows.push({ version: version.version, doc });
    }
  }
  return rows;
}

function appendSourceDocumentDetail(
  lines: string[],
  index: number,
  version: string,
  doc: SourceDoc,
): void {
  lines.push(`#### ${index}. ${escapeMd(doc.title) || "(제목 없음)"}`);
  lines.push(``);
  lines.push(`- 문서 ID: \`${doc.id}\``);
  lines.push(`- 버전: \`${version}\``);
  lines.push(`- 자료 유형: ${doc.sourceType || "-"}`);
  lines.push(`- 형식: ${doc.sourceFormat || "-"}`);
  lines.push(`- 검증 상태: ${doc.validationStatus}`);
  if (doc.validationScore != null) {
    lines.push(`- 검증 점수: ${doc.validationScore}`);
  }
  if (doc.productVersion?.trim()) {
    lines.push(`- productVersion: ${escapeMd(doc.productVersion)}`);
  }
  if (doc.sourceUrl?.trim()) {
    lines.push(`- sourceUrl: ${escapeMd(doc.sourceUrl)}`);
  }
  lines.push(``);
  lines.push(`**검증 요약**`);
  lines.push(``);
  lines.push(escapeMd(doc.validationSummary ?? "") || "(요약 없음)");
  lines.push(``);

  const issues = doc.validationIssues ?? [];
  if (issues.length > 0) {
    lines.push(`**검증 이슈 (${issues.length}건)**`);
    lines.push(``);
    for (const [issueIndex, issue] of issues.entries()) {
      const field = issue.field?.trim() ? ` · field=\`${escapeMd(issue.field)}\`` : "";
      const hint = issue.hint?.trim() ? ` · hint: ${escapeMd(issue.hint)}` : "";
      lines.push(
        `${issueIndex + 1}. **[${escapeMd(issue.severity)}]** \`${escapeMd(issue.code)}\` — ${escapeMd(issue.message)}${field}${hint}`,
      );
    }
    lines.push(``);
  } else {
    lines.push(`**검증 이슈:** 개별 이슈 목록 없음 (요약만 제공됨)`);
    lines.push(``);
  }

  if (doc.contentPreview?.trim()) {
    const preview = escapeMd(doc.contentPreview);
    const clipped = preview.length > 600 ? `${preview.slice(0, 600)}…` : preview;
    lines.push(`**본문 미리보기**`);
    lines.push(``);
    lines.push("```");
    lines.push(clipped);
    lines.push("```");
    lines.push(``);
  }
}

function appendGateMessages(lines: string[], detail: AdminReviewDetailDto): void {
  const r = detail.readiness;
  const messages: Array<{ label: string; value: string | null | undefined }> = [
    { label: "구조/품질 메시지", value: r.structureQualityMessage },
    { label: "청킹 품질 메시지", value: r.chunkQualityMessage },
    { label: "검색 평가 메시지", value: r.retrievalEvaluationMessage },
    { label: "릴리스 게이트 메시지", value: r.releaseGateMessage },
  ];
  const present = messages.filter((m) => m.value?.trim());
  if (present.length === 0) return;
  lines.push(`## 게이트 상세 메시지`);
  lines.push(``);
  for (const m of present) {
    lines.push(`### ${m.label}`);
    lines.push(``);
    lines.push(escapeMd(m.value!));
    lines.push(``);
  }
}

/**
 * Builds a detailed Markdown report for the Admin "주의 이슈" card.
 * Expands source-validation WARNINGs per document instead of a count-only line.
 */
export function buildReviewIssuesDetailMarkdown(input: {
  readonly detail: AdminReviewDetailDto;
  readonly exportedAt?: string;
}): string {
  const detail = input.detail;
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const blockers = collectReviewBlockers(detail);
  const warnings = collectReviewWarnings(detail);
  const sourceWarnings = listSourceWarningDocuments(detail);

  const lines: string[] = [
    `# 차단/주의 이슈 상세`,
    ``,
    `- 지식팩: ${escapeMd(detail.pack.name)}`,
    `- packId: \`${detail.pack.packId}\``,
    `- exportedAt: ${exportedAt}`,
    ``,
    `## 요약`,
    ``,
    `- 차단 이슈: **${blockers.length}**건`,
    `- 주의 이슈(요약): **${warnings.length}**건`,
    `- 원천 검증 WARNING 문서: **${sourceWarnings.length}**건`,
    `- 원천 검증 집계: PASS ${detail.readiness.sourceValidation.passCount} · WARNING ${detail.readiness.sourceValidation.warningCount} · FAIL ${detail.readiness.sourceValidation.failCount} · 미점검 ${detail.readiness.sourceValidation.notCheckedCount}`,
    ``,
  ];

  lines.push(`## 차단 이슈`);
  lines.push(``);
  if (blockers.length === 0) {
    lines.push(`차단 이슈 없음`);
    lines.push(``);
  } else {
    for (const [index, item] of blockers.entries()) {
      lines.push(`### ${index + 1}. 차단`);
      lines.push(``);
      lines.push(escapeMd(item));
      lines.push(``);
    }
  }

  lines.push(`## 주의 이슈 (요약)`);
  lines.push(``);
  if (warnings.length === 0) {
    lines.push(`주의 이슈 없음`);
    lines.push(``);
  } else {
    for (const [index, item] of warnings.entries()) {
      lines.push(`### ${index + 1}. 주의`);
      lines.push(``);
      lines.push(escapeMd(item));
      lines.push(``);
    }
  }

  appendGateMessages(lines, detail);

  lines.push(`## 원천 검증 WARNING 문서 상세`);
  lines.push(``);
  if (sourceWarnings.length === 0) {
    lines.push(`WARNING 상태인 원천 문서가 없습니다.`);
    lines.push(``);
  } else {
    lines.push(
      `아래는 원천 검증이 WARNING인 문서별 상세입니다. (라이선스/검토 전용 문서는 제외)`,
    );
    lines.push(``);
    sourceWarnings.forEach(({ version, doc }, index) => {
      appendSourceDocumentDetail(lines, index + 1, version, doc);
    });
  }

  return lines.join("\n");
}
