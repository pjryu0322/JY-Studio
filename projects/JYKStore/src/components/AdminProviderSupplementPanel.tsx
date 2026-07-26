"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { postAdminProviderSupplementAction } from "@/lib/admin-review-api";
import {
  buildAdminSupplementRequestViewModel,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import { adminReviewDetailPath } from "@/lib/routes";

export function AdminProviderSupplementPanel({
  packId,
  state,
  providerName,
  onChanged,
}: {
  readonly packId: string;
  readonly state: ProviderSupplementRequestState | null;
  readonly providerName?: string | null;
  readonly onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [clarifyMessage, setClarifyMessage] = useState("");
  const [nextStep, setNextStep] = useState<"NONE" | "WORKER_REPROCESS" | "QUALITY_RECHECK">(
    "NONE",
  );

  const vm = useMemo(
    () => (state && state.adminPhase !== "WITHDRAWN" ? buildAdminSupplementRequestViewModel(state) : null),
    [state],
  );

  if (!state || !vm) return null;

  const actions = new Set(vm.availableActions);

  const run = async (
    action:
      | "ACCEPT"
      | "RESOLVE"
      | "REJECT"
      | "CLARIFY"
      | "REQUEST_PROVIDER_REVIEW_AGAIN",
  ) => {
    setBusy(action);
    setError(null);
    try {
      await postAdminProviderSupplementAction(packId, {
        action,
        resolutionNote,
        rejectionReason,
        clarifyMessage,
        nextAdminStep: nextStep,
      });
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const hintTone =
    vm.handlingHint.owner === "ADMIN"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : vm.handlingHint.owner === "PROVIDER"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <section className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-900">제공자 보완요청사항</h2>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900">
          {vm.displayStatus}
        </span>
      </div>

      <dl className="grid gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2.5 text-xs text-slate-800 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-store-muted">
            요청자
          </dt>
          <dd className="mt-0.5 font-medium">{providerName?.trim() || "제공자"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-store-muted">
            요청일시
          </dt>
          <dd className="mt-0.5 font-medium">
            {new Date(vm.requestedAt).toLocaleString("ko-KR")}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-store-muted">
            요청 유형
          </dt>
          <dd className="mt-0.5 font-medium">{vm.issueTypeLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-store-muted">
            대상 위치
          </dt>
          <dd className="mt-0.5 font-medium">
            {[vm.targetKindLabel, vm.targetLabel].filter(Boolean).join(" · ") || "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-store-muted">
            제공자 요청내용
          </dt>
          <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-slate-800">
            {vm.details}
          </dd>
        </div>
      </dl>

      <div className={`rounded-xl border px-3 py-2.5 text-xs ${hintTone}`}>
        <p className="font-bold">{vm.handlingHint.title}</p>
        <p className="mt-1">{vm.handlingHint.guidance}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {vm.evidenceLinks.map((link) => (
          <Link
            key={link.id}
            href={`${adminReviewDetailPath(packId)}?step=${link.step}`}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-store-accent"
          >
            {link.label} 보기
          </Link>
        ))}
      </div>

      {state.clarifyMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          추가 확인 요청: {state.clarifyMessage}
        </p>
      ) : null}
      {state.rejectionReason ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          반려 사유: {state.rejectionReason}
        </p>
      ) : null}
      {state.resolutionNote ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          관리자 조치 메모: {state.resolutionNote}
        </p>
      ) : null}

      {state.providerNotes.length > 0 ? (
        <div className="space-y-1.5 text-xs">
          <p className="font-semibold text-slate-800">제공자 추가 의견</p>
          {state.providerNotes.map((n) => (
            <p
              key={`${n.at}-${n.text.slice(0, 12)}`}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700"
            >
              <span className="text-[10px] text-store-muted">
                {new Date(n.at).toLocaleString("ko-KR")}
              </span>
              <br />
              {n.text}
            </p>
          ))}
        </div>
      ) : null}

      {state.history.length > 0 ? (
        <details className="text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold">관리자 조치 이력</summary>
          <ul className="mt-1.5 space-y-1">
            {[...state.history].reverse().map((h) => (
              <li key={`${h.at}-${h.action}`}>
                {new Date(h.at).toLocaleString("ko-KR")} · {h.byRole} · {h.action}
                {h.note ? ` — ${h.note}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 border-t border-rose-100 pt-3">
        {actions.has("ACCEPT") ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run("ACCEPT")}
            className="min-h-[40px] rounded-xl bg-store-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === "ACCEPT" ? "접수 중…" : "보완요청 접수"}
          </button>
        ) : null}

        {actions.has("ADMIN_FIX") || actions.has("RUN_REPROCESS") ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-800">관리자 보완 처리</p>
            <label className="block text-xs text-slate-700">
              조치 메모
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-store-border bg-white px-2.5 py-2 text-xs"
                placeholder="조치 내용·판단 근거를 입력하세요"
              />
            </label>
            {actions.has("RUN_REPROCESS") ? (
              <label className="block text-xs text-slate-700">
                재처리 연결
                <select
                  value={nextStep}
                  onChange={(e) =>
                    setNextStep(
                      e.target.value as "NONE" | "WORKER_REPROCESS" | "QUALITY_RECHECK",
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-store-border bg-white px-2.5 py-2 text-xs"
                >
                  <option value="NONE">지정 안 함</option>
                  <option value="WORKER_REPROCESS">Worker 재처리</option>
                  <option value="QUALITY_RECHECK">품질점검 재진입</option>
                </select>
              </label>
            ) : null}
            {actions.has("ADMIN_FIX") ? (
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void run("RESOLVE")}
                className="min-h-[40px] rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-50"
              >
                {busy === "RESOLVE" ? "처리 중…" : "관리자 보완 처리 완료"}
              </button>
            ) : null}
            {actions.has("RUN_REPROCESS") ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`${adminReviewDetailPath(packId)}?step=generation`}
                  className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-900"
                >
                  재처리 실행 (생성)
                </Link>
                <Link
                  href={`${adminReviewDetailPath(packId)}?step=quality`}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-950"
                >
                  품질점검 재진입
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {actions.has("ASK_PROVIDER_MORE_INFO") ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              제공자에게 추가 확인 요청
              <textarea
                value={clarifyMessage}
                onChange={(e) => setClarifyMessage(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-store-border bg-white px-2.5 py-2 text-xs"
                placeholder="확인할 내용·필요한 자료를 입력하세요"
              />
            </label>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void run("CLARIFY")}
              className="min-h-[40px] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 disabled:opacity-50"
            >
              {busy === "CLARIFY" ? "요청 중…" : "제공자에게 추가 확인 요청"}
            </button>
          </div>
        ) : null}

        {actions.has("REJECT") ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              보완요청 반려 (사유 필수)
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-store-border bg-white px-2.5 py-2 text-xs"
                placeholder="반려 사유를 입력하세요"
              />
            </label>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void run("REJECT")}
              className="min-h-[40px] rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-900 disabled:opacity-50"
            >
              {busy === "REJECT" ? "반려 중…" : "보완요청 반려"}
            </button>
          </div>
        ) : null}

        {actions.has("REQUEST_PROVIDER_REVIEW_AGAIN") ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void run("REQUEST_PROVIDER_REVIEW_AGAIN")}
            className="min-h-[40px] rounded-xl bg-store-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === "REQUEST_PROVIDER_REVIEW_AGAIN"
              ? "요청 중…"
              : "보완 완료 후 제공자 재검토 요청"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
