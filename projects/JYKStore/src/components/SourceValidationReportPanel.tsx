import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";

type ValidationIssue = AdminReviewDetailDto["versions"][number]["sourceDocuments"][number]["validationIssues"][number];

export function SourceValidationReportPanel({
  score,
  blockingIssueCount,
  warningIssueCount,
  issues,
}: {
  readonly score: number | null;
  readonly blockingIssueCount: number;
  readonly warningIssueCount: number;
  readonly issues: ValidationIssue[];
}) {
  if (issues.length === 0 && score === null) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-xs text-slate-700">
        검증 점수: {score ?? "—"}
        {blockingIssueCount > 0 ? ` · 차단 ${blockingIssueCount}` : ""}
        {warningIssueCount > 0 ? ` · 주의 ${warningIssueCount}` : ""}
      </p>
      {issues.length > 0 ? (
        <ul className="space-y-1">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className={`text-xs ${issue.severity === "BLOCKER" ? "text-red-800" : "text-amber-800"}`}
            >
              <span className="font-mono text-[10px]">{issue.severity}</span> {issue.code}: {issue.message}
              {issue.hint ? <span className="text-store-muted"> — {issue.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
