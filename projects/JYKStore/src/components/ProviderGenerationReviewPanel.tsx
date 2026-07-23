"use client";

import { useState } from "react";
import {
  confirmProviderStoreReviewApi,
  withdrawProviderStoreReviewApi,
} from "@/lib/provider-center-api";

/**
 * Provider "생성 결과 검토" actions after admin requests confirmation.
 */
export function ProviderGenerationReviewPanel({
  packId,
  phase,
  qualitySummary,
  onChanged,
}: {
  readonly packId: string;
  readonly phase: "REQUESTED" | "CONFIRMED" | "WITHDRAWN" | "NONE";
  readonly qualitySummary?: {
    structure?: string | null;
    chunk?: string | null;
    retrieval?: string | null;
  };
  readonly onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<"confirm" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (phase !== "REQUESTED" && phase !== "CONFIRMED") {
    return null;
  }

  const run = async (action: "confirm" | "withdraw") => {
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      if (action === "confirm") {
        await confirmProviderStoreReviewApi(packId);
        setMessage("확인 완료했습니다. 관리자 서비스 검증을 기다립니다.");
      } else {
        await withdrawProviderStoreReviewApi(packId);
        setMessage("회수했습니다. 자료를 다시 등록할 수 있습니다.");
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">생성 결과 검토</h2>
        <p className="mt-1 text-xs text-store-muted">
          {phase === "REQUESTED"
            ? "관리자가 생성·품질점검한 결과를 확인한 뒤 확인 완료하거나, 문제가 있으면 회수 후 자료를 다시 등록하세요."
            : "확인이 완료되었습니다. 관리자 서비스 검증·최종 검수 결과를 기다려 주세요."}
        </p>
      </div>

      <dl className="grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <dt className="text-store-muted">구조/품질</dt>
          <dd className="mt-0.5 font-semibold">{qualitySummary?.structure ?? "-"}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <dt className="text-store-muted">청킹 품질</dt>
          <dd className="mt-0.5 font-semibold">{qualitySummary?.chunk ?? "-"}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <dt className="text-store-muted">검색 평가</dt>
          <dd className="mt-0.5 font-semibold">{qualitySummary?.retrieval ?? "-"}</dd>
        </div>
      </dl>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}

      {phase === "REQUESTED" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run("confirm")}
            className="min-h-[44px] flex-1 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy === "confirm" ? "처리 중…" : "확인 완료"}
          </button>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run("withdraw")}
            className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-60"
          >
            {busy === "withdraw" ? "처리 중…" : "회수하고 자료 다시 등록"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
