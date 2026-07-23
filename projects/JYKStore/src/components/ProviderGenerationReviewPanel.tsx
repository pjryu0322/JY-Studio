"use client";

import { useMemo, useState } from "react";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  confirmProviderStoreReviewApi,
  withdrawProviderStoreReviewApi,
} from "@/lib/provider-center-api";
import {
  formatProviderReviewQualityLabel,
  overallProviderReviewQualityLabel,
  PROVIDER_CHANGES_REQUEST_TARGETS,
  PROVIDER_CHANGES_REQUEST_TYPES,
  type ProviderChangesRequestPayload,
  type ProviderChangesRequestTarget,
  type ProviderChangesRequestType,
} from "@/lib/provider-review-workbench";

/**
 * Provider generation-result review workbench (detail only).
 * List cards must not expose 확인 완료 — only "상세 검토하기" entry.
 */
export function ProviderGenerationReviewPanel({
  packId,
  pack,
  phase,
  onChanged,
}: {
  readonly packId: string;
  readonly pack: ProviderPackDetailDto | null;
  readonly phase: "REQUESTED" | "CONFIRMED" | "WITHDRAWN" | "NONE";
  readonly onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<"confirm" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [changeType, setChangeType] = useState<ProviderChangesRequestType>("OTHER");
  const [targetKind, setTargetKind] = useState<ProviderChangesRequestTarget>("OTHER");
  const [targetLabel, setTargetLabel] = useState("");
  const [details, setDetails] = useState("");

  const quality = useMemo(() => {
    const structure = pack?.structureQuality?.knowledgeQuality?.status ?? null;
    const chunk = pack?.chunkQuality?.report?.status ?? null;
    const retrieval = pack?.retrievalEvaluation?.latestRun?.status ?? null;
    return {
      structure,
      chunk,
      retrieval,
      overall: overallProviderReviewQualityLabel({ structure, chunk, retrieval }),
    };
  }, [pack]);

  const sourceDocs = pack?.versions[0]?.sourceDocuments?.slice(0, 8) ?? [];
  const chunkSamples = pack?.chunkQuality?.report?.metrics?.slice(0, 5) ?? [];
  const structureIssues =
    pack?.structureQuality?.knowledgeQuality?.issues?.slice(0, 5) ?? [];
  const chunkIssues = pack?.chunkQuality?.report?.issues?.slice(0, 5) ?? [];
  const retrievalFails =
    pack?.retrievalEvaluation?.latestRun?.failedResults?.slice(0, 5) ?? [];
  const checkedAt =
    pack?.chunkQuality?.report?.checkedAt ??
    pack?.structureQuality?.knowledgeQuality?.checkedAt ??
    pack?.updatedAt ??
    null;

  if (phase !== "REQUESTED" && phase !== "CONFIRMED") {
    return null;
  }

  const runConfirm = async () => {
    const ok = window.confirm(
      "생성 결과를 검토했고 확인 완료할까요?\n확인 후에는 관리자 서비스 검증 단계로 넘어갑니다.",
    );
    if (!ok) return;
    setBusy("confirm");
    setError(null);
    setMessage(null);
    try {
      await confirmProviderStoreReviewApi(packId);
      setMessage("확인 완료했습니다. 관리자 서비스 검증을 기다립니다.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const runChangesRequest = async () => {
    const trimmed = details.trim();
    if (!trimmed) {
      setError("보완 요청 내용을 입력해 주세요.");
      return;
    }
    const payload: ProviderChangesRequestPayload = {
      changeType,
      targetKind,
      targetLabel: targetLabel.trim() || undefined,
      details: trimmed,
    };
    setBusy("withdraw");
    setError(null);
    setMessage(null);
    try {
      await withdrawProviderStoreReviewApi(packId, payload);
      setMessage("보완 요청을 제출했습니다. 자료를 다시 등록할 수 있습니다.");
      setFormOpen(false);
      setDetails("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      id="provider-generation-review"
      className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-card"
    >
      <div>
        <h2 className="text-sm font-bold text-slate-900">생성 결과 상세 검토</h2>
        <p className="mt-1 text-xs text-store-muted">
          {phase === "REQUESTED"
            ? "관리자가 생성·품질점검한 지식데이터를 검토한 뒤 확인 완료하거나 보완 요청을 작성하세요."
            : "확인이 완료되었습니다. 관리자 서비스 검증·최종 검수 결과를 기다려 주세요."}
        </p>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 sm:grid-cols-2">
        <div>
          <p className="text-store-muted">지식팩</p>
          <p className="mt-0.5 font-semibold">{pack?.name ?? packId}</p>
        </div>
        <div>
          <p className="text-store-muted">품질 요약</p>
          <p className="mt-0.5 font-semibold">{quality.overall}</p>
        </div>
        <div>
          <p className="text-store-muted">구조화</p>
          <p className="mt-0.5 font-semibold">
            {formatProviderReviewQualityLabel(quality.structure)}
          </p>
        </div>
        <div>
          <p className="text-store-muted">청킹</p>
          <p className="mt-0.5 font-semibold">
            {formatProviderReviewQualityLabel(quality.chunk)}
          </p>
        </div>
        <div>
          <p className="text-store-muted">검색 평가</p>
          <p className="mt-0.5 font-semibold">
            {formatProviderReviewQualityLabel(quality.retrieval)}
          </p>
        </div>
        <div>
          <p className="text-store-muted">품질 점검 시각</p>
          <p className="mt-0.5 font-semibold">
            {checkedAt ? new Date(checkedAt).toLocaleString("ko-KR") : "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-900">검토 대상 미리보기</h3>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold text-slate-700">원본 파일</p>
          {sourceDocs.length === 0 ? (
            <p className="mt-1 text-[11px] text-store-muted">등록된 원본 파일이 없습니다.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[11px] text-slate-700">
              {sourceDocs.map((doc) => (
                <li key={doc.id} className="truncate">
                  {doc.title}{" "}
                  <span className="text-store-muted">({doc.sourceFormat || doc.sourceType})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold text-slate-700">Chunk 샘플</p>
          {chunkSamples.length === 0 ? (
            <p className="mt-1 text-[11px] text-store-muted">표시할 Chunk 샘플이 없습니다.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[11px] text-slate-700">
              {chunkSamples.map((m, idx) => (
                <li key={`${m.chunkId ?? idx}`} className="truncate">
                  {m.title || m.chunkId || `Chunk ${idx + 1}`}
                  {typeof m.contentLength === "number" ? (
                    <span className="text-store-muted"> · {m.contentLength}자</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold text-slate-700">검색 평가 샘플</p>
          {retrievalFails.length === 0 ? (
            <p className="mt-1 text-[11px] text-store-muted">
              실패한 검색 샘플이 없거나 평가 결과가 없습니다.
            </p>
          ) : (
            <ul className="mt-1 space-y-1 text-[11px] text-slate-700">
              {retrievalFails.map((row, idx) => (
                <li key={`${row.query ?? idx}`} className="truncate">
                  Q: {row.query || `질문 ${idx + 1}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-900">품질점검 상세</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold text-slate-700">구조화 이슈</p>
            {structureIssues.length === 0 ? (
              <p className="mt-1 text-[11px] text-store-muted">표시할 이슈가 없습니다.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-700">
                {structureIssues.map((issue, idx) => (
                  <li key={`${issue.code ?? idx}`}>
                    {issue.message || issue.code || `이슈 ${idx + 1}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold text-slate-700">청킹 이슈</p>
            {chunkIssues.length === 0 ? (
              <p className="mt-1 text-[11px] text-store-muted">표시할 이슈가 없습니다.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-700">
                {chunkIssues.map((issue, idx) => (
                  <li key={`${issue.code ?? idx}`}>
                    {issue.message || issue.code || `이슈 ${idx + 1}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}

      {phase === "REQUESTED" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void runConfirm()}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy === "confirm" ? "처리 중…" : "확인 완료"}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => {
              setFormOpen(true);
              setError(null);
            }}
            className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-60"
          >
            보완 요청 작성
          </button>
        </div>
      ) : null}

      {formOpen && phase === "REQUESTED" ? (
        <div className="space-y-3 rounded-xl border border-slate-300 bg-white p-3">
          <h3 className="text-sm font-bold text-slate-900">보완 요청 작성</h3>
          <label className="block text-xs font-semibold text-slate-700">
            보완 유형
            <select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as ProviderChangesRequestType)}
              className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
            >
              {PROVIDER_CHANGES_REQUEST_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            보완 대상
            <select
              value={targetKind}
              onChange={(e) => setTargetKind(e.target.value as ProviderChangesRequestTarget)}
              className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
            >
              {PROVIDER_CHANGES_REQUEST_TARGETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            대상 식별 (선택)
            <input
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
              placeholder="파일명, 섹션, Chunk ID 등"
              className="mt-1 min-h-[36px] w-full rounded-lg border border-store-border px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            상세 요청 내용
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              required
              placeholder="어떤 문제가 있는지, 어떻게 보완하면 되는지 구체적으로 적어 주세요."
              className="mt-1 w-full rounded-lg border border-store-border px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null || !details.trim()}
              onClick={() => void runChangesRequest()}
              className="min-h-[40px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy === "withdraw" ? "제출 중…" : "보완 요청 제출"}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => setFormOpen(false)}
              className="min-h-[40px] rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-700"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
