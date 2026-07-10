"use client";

import { useState } from "react";
import { SourceValidationBadge } from "@/components/SourceValidationBadge";
import { SourceValidationReportPanel } from "@/components/SourceValidationReportPanel";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { validateAdminPackSourcesApi } from "@/lib/admin-review-api";
import { getSourceFormatLabel, getSourceTypeLabel } from "@/lib/source-type-dto";
import {
  ADMIN_REVIEW_VIEW_SOURCE,
  ADMIN_REVIEW_VIEW_VALIDATION,
} from "@/lib/role-based-ux-copy";

function validationStatusLabel(status: string): string {
  if (status === "PASS") return "통과";
  if (status === "WARNING") return "주의";
  if (status === "FAIL") return "실패";
  return "미검사";
}

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
  const [previewIds, setPreviewIds] = useState<Record<string, boolean>>({});
  const [validationIds, setValidationIds] = useState<Record<string, boolean>>({});

  const runValidate = async (sourceDocumentId?: string) => {
    setError(null);
    if (sourceDocumentId) {
      setBusyId(sourceDocumentId);
    } else {
      setValidatingAll(true);
    }
    try {
      const data = await validateAdminPackSourcesApi(
        packId,
        sourceDocumentId ? { sourceDocumentId } : undefined,
      );
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
                {version.sourceDocuments.map((doc) => {
                  const previewOpen = Boolean(previewIds[doc.id]);
                  const validationOpen = Boolean(validationIds[doc.id]);
                  return (
                    <li key={doc.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                          {doc.title}
                        </p>
                        <SourceValidationBadge status={doc.validationStatus} />
                      </div>
                      <dl className="mt-2 grid gap-1 text-xs text-store-muted">
                        <div>
                          상태:{" "}
                          <span className="text-slate-800">
                            {validationStatusLabel(doc.validationStatus)}
                          </span>
                        </div>
                        <div>
                          유형:{" "}
                          <span className="text-slate-800">
                            {getSourceTypeLabel(doc.sourceType)} ·{" "}
                            {getSourceFormatLabel(doc.sourceFormat)}
                          </span>
                        </div>
                        {(doc.blockingIssueCount > 0 || doc.warningIssueCount > 0) && (
                          <div>
                            이슈:{" "}
                            <span className="text-slate-800">
                              차단 {doc.blockingIssueCount} · 경고 {doc.warningIssueCount}
                            </span>
                          </div>
                        )}
                        {doc.sourceUrl ? (
                          <div className="break-all">
                            원천 URL:{" "}
                            <a
                              href={doc.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-store-accent underline-offset-2 hover:underline"
                            >
                              {doc.sourceUrl}
                            </a>
                          </div>
                        ) : null}
                        {doc.productVersion ? (
                          <div>
                            productVersion:{" "}
                            <span className="text-slate-800">{doc.productVersion}</span>
                          </div>
                        ) : (
                          <div className="text-amber-800">productVersion 없음</div>
                        )}
                      </dl>
                      {doc.validationSummary && doc.validationStatus !== "PASS" ? (
                        <p className="mt-1 text-xs text-amber-700">{doc.validationSummary}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {doc.contentPreview ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewIds((prev) => ({
                                ...prev,
                                [doc.id]: !prev[doc.id],
                              }))
                            }
                            className="min-h-[40px] rounded-lg border border-store-border bg-white px-3 text-xs font-semibold"
                          >
                            {previewOpen ? "원문 접기" : ADMIN_REVIEW_VIEW_SOURCE}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setValidationIds((prev) => ({
                              ...prev,
                              [doc.id]: !prev[doc.id],
                            }))
                          }
                          className="min-h-[40px] rounded-lg border border-store-border bg-white px-3 text-xs font-semibold"
                        >
                          {validationOpen ? "검증 결과 접기" : ADMIN_REVIEW_VIEW_VALIDATION}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === doc.id || validatingAll}
                          onClick={() => void runValidate(doc.id)}
                          className="min-h-[40px] rounded-lg border border-store-border bg-white px-3 text-xs font-semibold disabled:opacity-50"
                        >
                          {busyId === doc.id ? "검증 중…" : "재검증"}
                        </button>
                      </div>
                      {validationOpen ? (
                        <SourceValidationReportPanel
                          score={doc.validationScore}
                          blockingIssueCount={doc.blockingIssueCount}
                          warningIssueCount={doc.warningIssueCount}
                          issues={doc.validationIssues}
                        />
                      ) : null}
                      {previewOpen && doc.contentPreview ? (
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-store-border bg-white p-2 text-xs text-slate-700">
                          {doc.contentPreview}
                        </pre>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
