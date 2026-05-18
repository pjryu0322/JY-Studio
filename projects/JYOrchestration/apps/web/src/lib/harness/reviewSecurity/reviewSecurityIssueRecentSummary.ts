/**
 * Harness Phase H6.5 — **Recent Review/Security Issue Summary**.
 *
 * 최근 N개의 promptTrace에서 추출한 `ReviewSecurityIssuePlanningReport` 묶음을 받아 누적/비율 기반
 * summary를 생성한다. H6 / H5.5와 같은 형태의 read-only 진단.
 *
 * **순수 함수 / 읽기 전용.** 실제 이슈 등록·머지 차단·조치 실행 영향 없음.
 */

import type { ReviewSecurityIssuePlanningReport } from "./reviewSecurityIssueTypes";

/** Recent issue summary 결과 타입. */
export type RecentReviewSecurityIssueSummary = Readonly<{
  /** 입력으로 받은 promptTrace 개수(=reportEntryCount 후보 모집단). */
  sampledEntryCount: number;
  /** 유효한 report(mode==="dry_run_issue_planning" + issues 배열)를 가진 entry 수. */
  reportEntryCount: number;
  /** 전체 issue 누계. */
  totalIssues: number;
  /** security area issue 비율(0–1, 정밀도 0.0001). */
  securityIssueRate: number;
  /** critical_candidate severity 비율(0–1). */
  criticalCandidateRate: number;
  /** needs_remediation status 비율(0–1). */
  needsRemediationRate: number;
  /** finding이 1개 이상 있던 report 비율(0–1). */
  findingRate: number;
}>;

/** Empty summary helper(replay/empty fallback). */
export function emptyRecentReviewSecurityIssueSummary(): RecentReviewSecurityIssueSummary {
  return {
    sampledEntryCount: 0,
    reportEntryCount: 0,
    totalIssues: 0,
    securityIssueRate: 0,
    criticalCandidateRate: 0,
    needsRemediationRate: 0,
    findingRate: 0,
  };
}

function roundRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 10_000) / 10_000;
}

function isValidReport(
  report: ReviewSecurityIssuePlanningReport | null | undefined
): report is ReviewSecurityIssuePlanningReport {
  return Boolean(
    report && report.mode === "dry_run_issue_planning" && Array.isArray(report.issues)
  );
}

/**
 * 최근 N개의 `ReviewSecurityIssuePlanningReport`를 비율 기반 누적 summary로 환산.
 *
 * - 입력 report는 호출자가 "최근 → 과거" 또는 "과거 → 최근" 순서로 자유롭게 넣어도 결과 동일.
 * - issues가 0개인 report는 분자만 0이고 모집단(=reportEntryCount)에는 포함.
 * - `findingRate`: report 단위. 다른 rate: issue 단위.
 */
export function summarizeRecentReviewSecurityIssuePlans(input: {
  readonly reports: readonly (ReviewSecurityIssuePlanningReport | null | undefined)[];
}): RecentReviewSecurityIssueSummary {
  const reports = Array.isArray(input.reports) ? input.reports : [];
  if (!reports.length) return emptyRecentReviewSecurityIssueSummary();

  const sampledEntryCount = reports.length;
  let reportEntryCount = 0;
  let totalIssues = 0;
  let securityIssues = 0;
  let criticalCandidates = 0;
  let needsRemediation = 0;
  let reportsWithFindings = 0;

  for (const report of reports) {
    if (!isValidReport(report)) continue;
    reportEntryCount += 1;
    if (Array.isArray(report.findings) && report.findings.length > 0) {
      reportsWithFindings += 1;
    }
    for (const issue of report.issues) {
      if (!issue) continue;
      totalIssues += 1;
      if (issue.area === "security") securityIssues += 1;
      if (issue.severity === "critical_candidate") criticalCandidates += 1;
      if (issue.status === "needs_remediation") needsRemediation += 1;
    }
  }

  const itemDen = totalIssues > 0 ? totalIssues : 0;
  const reportDen = reportEntryCount > 0 ? reportEntryCount : 0;

  return {
    sampledEntryCount,
    reportEntryCount,
    totalIssues,
    securityIssueRate: itemDen ? roundRate(securityIssues / itemDen) : 0,
    criticalCandidateRate: itemDen ? roundRate(criticalCandidates / itemDen) : 0,
    needsRemediationRate: itemDen ? roundRate(needsRemediation / itemDen) : 0,
    findingRate: reportDen ? roundRate(reportsWithFindings / reportDen) : 0,
  };
}
