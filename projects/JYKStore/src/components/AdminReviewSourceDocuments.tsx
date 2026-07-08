"use client";

import { useState } from "react";
import { SourceValidationBadge } from "@/components/SourceValidationBadge";
import { SourceValidationReportPanel } from "@/components/SourceValidationReportPanel";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { validateAdminPackSourcesApi } from "@/lib/admin-review-api";
import { getSourceFormatLabel, getSourceTypeLabel } from "@/lib/source-type-dto";

export function AdminReviewSourceDocuments({
  packId,
  versions,
  onValidated,
}: {
  readonly packId: string;
  readonly versions: AdminReviewDetailDto["versions"];
  readonly onValidated: (detail: AdminReviewDetailDto) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [validatingAll, setValidatingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runValidate = async (sourceDocumentId?: string) => {
    setError(null);
    if (sourceDocumentId) {
      setBusyId(sourceDocumentId);
    } else {
      setValidatingAll(true);
    }
    try {
      const data = await validateAdminPackSourcesApi(packId, sourceDocumentId ? { sourceDocumentId } : undefined);
      onValidated(data.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "재검증에 실패했습니다.");
    } finally {
      setBusyId(null);
      setValidatingAll(false);
    }
  };

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">버전 및 원천 문서</h3>
        <button
          type="button"
          disabled={validatingAll || busyId !== null}
          onClick={() => void runValidate()}
          className="min-h-[44px] w-full rounded-lg border border-store-border px-3 text-xs font-semibold text-slate-800 disabled:opacity-50 sm:w-auto"
        >
          {validatingAll ? "전체 검증 중…" : "전체 재검증"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{doc.title}</p>
                      <div className="flex items-center gap-2">
                        <SourceValidationBadge status={doc.validationStatus} />
                        <button
                          type="button"
                          disabled={busyId === doc.id || validatingAll}
                          onClick={() => void runValidate(doc.id)}
                          className="min-h-[44px] rounded-lg border border-store-border bg-white px-3 text-xs font-semibold disabled:opacity-50 sm:min-h-0 sm:px-2 sm:py-1 sm:text-[11px]"
                        >
                          {busyId === doc.id ? "검증 중…" : "재검증"}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-store-muted">
                      {getSourceTypeLabel(doc.sourceType)} · {getSourceFormatLabel(doc.sourceFormat)}
                      {doc.productVersion ? ` · v${doc.productVersion}` : ""}
                      {doc.sourceUrl ? ` · ${doc.sourceUrl}` : ""}
                    </p>
                    {doc.validationSummary && doc.validationStatus !== "PASS" ? (
                      <p className="mt-1 text-xs text-amber-700">{doc.validationSummary}</p>
                    ) : null}
                    <SourceValidationReportPanel
                      score={doc.validationScore}
                      blockingIssueCount={doc.blockingIssueCount}
                      warningIssueCount={doc.warningIssueCount}
                      issues={doc.validationIssues}
                    />
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
