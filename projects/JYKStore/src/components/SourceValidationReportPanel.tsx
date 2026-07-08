export type SourceValidationIssueView = {
  severity: string;
  code: string;
  message: string;
  field?: string | null;
  hint?: string | null;
};

export function SourceValidationReportPanel({
  score,
  blockingIssueCount,
  warningIssueCount,
  issues,
  maxVisibleIssues = 10,
}: {
  readonly score: number | null;
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
  readonly issues: SourceValidationIssueView[];
  readonly maxVisibleIssues?: number;
}) {
  if (issues.length === 0 && score === null) {
    return null;
  }

  const visibleIssues = issues.slice(0, maxVisibleIssues);
  const hiddenCount = issues.length - visibleIssues.length;

  return (
    <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-xs text-slate-700">
        검증 점수: {score ?? "—"}
        {blockingIssueCount > 0 ? ` · 차단 ${blockingIssueCount}` : ""}
        {warningIssueCount > 0 ? ` · 주의 ${warningIssueCount}` : ""}
      </p>
      {visibleIssues.length > 0 ? (
        <ul className="space-y-1">
          {visibleIssues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className={`whitespace-pre-wrap text-xs ${issue.severity === "BLOCKER" ? "text-red-800" : "text-amber-800"}`}
            >
              <span className="font-mono text-[10px]">{issue.severity}</span> {issue.code}: {issue.message}
              {issue.hint ? <span className="text-store-muted"> — {issue.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {hiddenCount > 0 ? (
        <p className="text-xs text-store-muted">외 {hiddenCount}건의 이슈가 더 있습니다.</p>
      ) : null}
    </div>
  );
}
