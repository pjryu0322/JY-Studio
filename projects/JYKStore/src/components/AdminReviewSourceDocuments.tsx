import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";

export function AdminReviewSourceDocuments({
  versions,
}: {
  readonly versions: AdminReviewDetailDto["versions"];
}) {
  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-slate-900">버전 및 원천 문서</h3>
      <div className="mt-3 space-y-4">
        {versions.map((version) => (
          <div key={version.id} className="rounded-xl border border-store-border p-3">
            <p className="text-sm font-semibold text-slate-900">v{version.version}</p>
            <p className="mt-1 text-xs text-store-muted">{version.versionSummary}</p>
            {version.sourceDocuments.length === 0 ? (
              <p className="mt-2 text-xs text-store-muted">등록된 원천 문서 없음</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {version.sourceDocuments.map((doc) => (
                  <li key={doc.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-900">{doc.title}</p>
                    <p className="text-xs text-store-muted">
                      {doc.sourceType}
                      {doc.sourceUrl ? ` · ${doc.sourceUrl}` : ""}
                    </p>
                    {doc.contentPreview ? (
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                        {doc.contentPreview}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
