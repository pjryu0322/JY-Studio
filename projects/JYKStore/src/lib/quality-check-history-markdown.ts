/**
 * Markdown export for Admin "품질점검 내역".
 * Kept outside the client component so unit tests can import it without React.
 */
import type { AdminWorkerZipQualityRefreshResult } from "@/lib/admin-review-api";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { buildReviewIssuesDetailMarkdown } from "@/lib/admin-review-issues-markdown";

const STEP_LABELS: Record<string, string> = {
  source_validation: "원천 검증",
  structure_quality: "구조/품질",
  chunk_quality: "청킹 품질",
  retrieval_cases: "검색 케이스",
  retrieval_evaluation: "검색 평가",
  release_gate: "릴리스 게이트",
};

export function buildQualityCheckHistoryMarkdown(input: {
  packId: string;
  qualityResult: AdminWorkerZipQualityRefreshResult;
  detail?: AdminReviewDetailDto | null;
  exportedAt?: string;
}): string {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const q = input.qualityResult;
  const r = q.readiness;
  const lines: string[] = [
    `# 품질점검 내역`,
    ``,
    `- packId: \`${input.packId}\``,
    `- exportedAt: ${exportedAt}`,
    ``,
    `## 파이프라인`,
    ``,
  ];

  if (q.stoppedAt) {
    lines.push(`- 상태: 중단 (\`${q.stoppedAt}\`)`);
  } else {
    lines.push(`- 상태: 완료`);
  }
  lines.push(
    `- 완료 단계: ${
      q.stepsCompleted.length > 0
        ? q.stepsCompleted.map((id) => STEP_LABELS[id] ?? id).join(" → ")
        : "-"
    }`,
  );
  if (q.backfilledSourceDocuments > 0) {
    lines.push(`- 원천 본문 보완: ${q.backfilledSourceDocuments}건`);
  }
  if (q.retypedSourceDocuments > 0) {
    lines.push(`- 자료 유형 재분류: ${q.retypedSourceDocuments}건`);
  }
  lines.push(``);

  if (q.warnings.length > 0) {
    lines.push(`### 파이프라인 경고`);
    lines.push(``);
    for (const w of q.warnings) lines.push(`- ${w}`);
    lines.push(``);
  } else {
    lines.push(`경고 없이 파이프라인을 마쳤습니다.`);
    lines.push(``);
  }

  lines.push(`## Readiness 요약`);
  lines.push(``);
  lines.push(
    `- 원천 검증: PASS ${r.sourceValidation.passCount} · WARNING ${r.sourceValidation.warningCount} · FAIL ${r.sourceValidation.failCount} · 미점검 ${r.sourceValidation.notCheckedCount}`,
  );
  lines.push(`- 구조 커버리지: ${r.structureCoverageStatus ?? "-"}`);
  lines.push(`- 지식 품질: ${r.knowledgeQualityStatus ?? "-"}`);
  lines.push(`- 청킹 품질: ${r.chunkQualityStatus ?? "-"}`);
  lines.push(`- 검색 평가: ${r.retrievalEvaluationStatus ?? "-"}`);
  lines.push(`- 릴리스 게이트: ${r.releaseGateStatus ?? "-"}`);
  if (r.structureQualityMessage) lines.push(`- 구조/품질 메시지: ${r.structureQualityMessage}`);
  if (r.chunkQualityMessage) lines.push(`- 청킹 품질 메시지: ${r.chunkQualityMessage}`);
  if (r.retrievalEvaluationMessage) {
    lines.push(`- 검색 평가 메시지: ${r.retrievalEvaluationMessage}`);
  }
  if (r.releaseGateMessage) lines.push(`- 릴리스 게이트 메시지: ${r.releaseGateMessage}`);
  lines.push(``);

  if (input.detail) {
    lines.push(`---`);
    lines.push(``);
    lines.push(
      buildReviewIssuesDetailMarkdown({
        detail: input.detail,
        exportedAt,
      }),
    );
  }

  return lines.join("\n");
}
