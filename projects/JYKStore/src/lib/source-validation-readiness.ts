export type SourceValidationCounts = {
  passCount: number;
  warningCount: number;
  failCount: number;
  notCheckedCount: number;
};

export function countSourceValidationFromStatuses(
  statuses: readonly string[],
): SourceValidationCounts {
  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;
  let notCheckedCount = 0;

  for (const status of statuses) {
    switch (status) {
      case "PASS":
        passCount += 1;
        break;
      case "WARNING":
        warningCount += 1;
        break;
      case "FAIL":
        failCount += 1;
        break;
      case "NOT_CHECKED":
        notCheckedCount += 1;
        break;
      default:
        notCheckedCount += 1;
        break;
    }
  }

  return { passCount, warningCount, failCount, notCheckedCount };
}

/** Provider submit gate: FAIL and NOT_CHECKED block submission; WARNING is allowed. */
export function meetsSourceValidationSubmitGate(counts: SourceValidationCounts): boolean {
  return counts.failCount === 0 && counts.notCheckedCount === 0;
}

export type ReviewApproveBaseReadiness = {
  isReviewing: boolean;
  versionCount: number;
  sourceDocumentCount: number;
  hasRequiredDescription: boolean;
};

export function canApproveReviewReadiness(
  base: ReviewApproveBaseReadiness,
  counts: SourceValidationCounts,
): boolean {
  return (
    base.isReviewing &&
    base.versionCount > 0 &&
    base.sourceDocumentCount > 0 &&
    base.hasRequiredDescription &&
    counts.failCount === 0 &&
    counts.notCheckedCount === 0
  );
}

export function getApprovalBlockingSourceValidationMessage(
  counts: SourceValidationCounts,
): string | null {
  if (counts.failCount > 0) {
    return "검증에 실패(FAIL)한 원천 문서가 있어 승인할 수 없습니다.";
  }
  if (counts.notCheckedCount > 0) {
    return "검증되지 않은(NOT_CHECKED) 원천 문서가 있어 승인할 수 없습니다.";
  }
  return null;
}
