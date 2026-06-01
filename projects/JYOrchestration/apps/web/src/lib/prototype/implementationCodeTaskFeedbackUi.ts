import type { ImplementationCodeTaskFailureCauseLayer } from "@/lib/prototype/implementationCodeTaskFailureDiagnosis";
import type {
  ImplementationCodeTaskExecutionFeedbackEntryV1,
  ImplementationCodeTaskExecutionFeedbackV1,
} from "@/lib/prototype/implementationCodeTaskExecutionFeedback";

export type ImplementationCodeTaskFeedbackSummaryV1 = Readonly<{
  readonly passed: number;
  readonly failed: number;
  readonly running: number;
  readonly blocked: number;
  readonly failedCodeTaskIds: readonly string[];
  readonly latestFailureCauseLayer?: ImplementationCodeTaskFailureCauseLayer;
}>;

export type ImplementationCodeTaskFeedbackTaskRowV1 = Readonly<{
  readonly codeTaskId: string;
  readonly status: ImplementationCodeTaskExecutionFeedbackEntryV1["status"];
  readonly lastFailureReason?: string;
  readonly lastCauseLayer?: ImplementationCodeTaskFailureCauseLayer;
  readonly lastDiagnosisMessage?: string;
  readonly lastCommitSha?: string;
}>;

export function buildImplementationCodeTaskFeedbackSummary(
  feedback?: ImplementationCodeTaskExecutionFeedbackV1 | null,
): ImplementationCodeTaskFeedbackSummaryV1 | null {
  const entries = Object.values(feedback?.feedbackByCodeTaskId ?? {});
  if (!entries.length) return null;

  let passed = 0;
  let failed = 0;
  let running = 0;
  let blocked = 0;
  const failedCodeTaskIds: string[] = [];
  let latestFailureCauseLayer: ImplementationCodeTaskFailureCauseLayer | undefined;

  for (const entry of entries) {
    switch (entry.status) {
      case "passed":
        passed += 1;
        break;
      case "failed":
        failed += 1;
        failedCodeTaskIds.push(entry.codeTaskId);
        if (entry.lastCauseLayer) latestFailureCauseLayer = entry.lastCauseLayer;
        break;
      case "running":
        running += 1;
        break;
      case "blocked":
        blocked += 1;
        break;
      default:
        break;
    }
  }

  return {
    passed,
    failed,
    running,
    blocked,
    failedCodeTaskIds,
    ...(latestFailureCauseLayer ? { latestFailureCauseLayer } : {}),
  };
}

export function buildImplementationCodeTaskFeedbackTaskRows(
  feedback?: ImplementationCodeTaskExecutionFeedbackV1 | null,
): readonly ImplementationCodeTaskFeedbackTaskRowV1[] {
  return Object.values(feedback?.feedbackByCodeTaskId ?? {})
    .map((entry) => ({
      codeTaskId: entry.codeTaskId,
      status: entry.status,
      ...(entry.lastFailureReason ? { lastFailureReason: entry.lastFailureReason } : {}),
      ...(entry.lastCauseLayer ? { lastCauseLayer: entry.lastCauseLayer } : {}),
      ...(entry.lastDiagnosisMessage ? { lastDiagnosisMessage: entry.lastDiagnosisMessage } : {}),
      ...(entry.lastCommitSha ? { lastCommitSha: entry.lastCommitSha } : {}),
    }))
    .sort((a, b) => a.codeTaskId.localeCompare(b.codeTaskId));
}

export function formatCodeTaskFeedbackSummaryLine(
  summary: ImplementationCodeTaskFeedbackSummaryV1 | null | undefined,
): string | null {
  if (!summary) return null;
  const parts = [
    `CodeTask 실행: 성공 ${summary.passed} / 실패 ${summary.failed} / 진행 ${summary.running}`,
  ];
  if (summary.latestFailureCauseLayer) {
    parts.push(`최근 실패 원인: ${summary.latestFailureCauseLayer}`);
  }
  return parts.join(" · ");
}

export function formatCodeTaskFeedbackBoardLine(
  summary: ImplementationCodeTaskFeedbackSummaryV1 | null | undefined,
): string | null {
  if (!summary) return null;
  const parts = [`CodeTask feedback: failed ${summary.failed} / passed ${summary.passed}`];
  if (summary.latestFailureCauseLayer) {
    parts.push(`최근 실패 원인: ${summary.latestFailureCauseLayer}`);
  }
  return parts.join(" · ");
}
