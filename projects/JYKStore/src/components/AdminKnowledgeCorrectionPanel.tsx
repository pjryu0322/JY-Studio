"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  applyAdminCorrectionCase,
  closeAdminCorrectionCase,
  fetchAdminCorrectionWorkbench,
  regenerateAdminCorrection,
  syncAdminCorrectionWorkbench,
  verifyAdminCorrectionCase,
  type AdminCorrectionCase,
  type AdminCorrectionWorkbenchSummary,
} from "@/lib/admin-review-api";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import { adminReviewDetailPath } from "@/lib/routes";

/**
 * P5 Exception-only Correction Workbench (`?step=correction`).
 * Shows Blocker/Warning cases only — not a full chunk editor.
 */

type SeverityFilter = "all" | "BLOCKER" | "WARNING";

const FILTERS: { id: SeverityFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "BLOCKER", label: "차단" },
  { id: "WARNING", label: "주의" },
];

const ACTION_LABELS: Record<string, string> = {
  FILE_EXCLUDE: "지식화 제외",
  FILE_REQUEST_PROVIDER: "제공자 확인 요청",
  STRUCTURE_DELETE: "구조 삭제",
  STRUCTURE_MERGE: "구조 통합",
  CHUNK_DELETE: "Chunk 삭제",
  CHUNK_MERGE: "Chunk 통합",
};

function statusLabel(status: AdminCorrectionCase["status"]): string {
  switch (status) {
    case "OPEN":
      return "대기";
    case "APPLIED":
      return "적용됨";
    case "REGENERATED":
      return "재생성됨";
    case "VERIFIED":
      return "검증됨";
    case "CLOSED":
      return "종료";
    default:
      return status;
  }
}

function targetLabel(type: AdminCorrectionCase["targetType"]): string {
  if (type === "FILE") return "파일";
  if (type === "STRUCTURE") return "구조";
  return "Chunk";
}

export function AdminKnowledgeCorrectionPanel({
  packId,
  detail = null,
  workerZipPhase,
  quality,
  providerReviewPhase = "NONE",
  searchIndexStatus = "미확인",
  onGoGeneration,
  onRerunQuality,
  onGoProviderReview,
  onGoSearchValidation,
  onChanged,
}: {
  readonly packId: string;
  readonly packName?: string;
  readonly detail?: AdminReviewDetailDto | null;
  readonly workerZipPhase: string;
  readonly quality: AdminQualityGateSnapshot;
  readonly providerReviewPhase?: string;
  readonly searchIndexStatus?: string;
  readonly onGoGeneration?: () => void;
  readonly onRerunQuality?: () => void;
  readonly onGoProviderReview?: () => void;
  readonly onGoSearchValidation?: () => void;
  readonly onChanged?: () => void;
}) {
  const generationDone = workerZipPhase === "COMPLETED";
  const readyForProvider =
    generationDone && quality.completed && !quality.hasBlockers && quality.failCount === 0;
  const showSearchValidationCta =
    readyForProvider && providerReviewPhase === "CONFIRMED";

  const [summary, setSummary] = useState<AdminCorrectionWorkbenchSummary | null>(null);
  const [cases, setCases] = useState<AdminCorrectionCase[]>([]);
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [secondaryTargetId, setSecondaryTargetId] = useState("");
  const [showTech, setShowTech] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchAdminCorrectionWorkbench(packId);
    setSummary(data.summary);
    setCases(data.cases);
  }, [packId]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void syncAdminCorrectionWorkbench(packId)
      .then((data) => {
        if (cancelled) return;
        setSummary(data.summary);
        setCases(data.cases);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "보정 큐 동기화에 실패했습니다.");
        void load().catch(() => undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [packId, load, quality.blockers.length, quality.warnings.length, detail?.pack.updatedAt]);

  const filtered = useMemo(() => {
    if (filter === "all") return cases;
    return cases.filter((c) => c.severity === filter);
  }, [cases, filter]);

  const selected =
    filtered.find((c) => c.id === selectedId) ??
    cases.find((c) => c.id === selectedId) ??
    filtered[0] ??
    null;

  const filterCounts = useMemo(() => {
    return {
      all: cases.length,
      BLOCKER: cases.filter((c) => c.severity === "BLOCKER").length,
      WARNING: cases.filter((c) => c.severity === "WARNING").length,
    };
  }, [cases]);

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-store-border bg-white px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">예외 보정 Workbench</h2>
            <p className="mt-0.5 text-[11px] text-store-muted">
              자동 처리 후에도 남은 예외만 보정합니다. Chunk 전체 목록은 표시하지 않습니다.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                const data = await syncAdminCorrectionWorkbench(packId);
                setSummary(data.summary);
                setCases(data.cases);
              })
            }
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 disabled:opacity-50"
          >
            품질 기준 동기화
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] text-store-muted">보정 필요</p>
            <p className="text-lg font-bold tabular-nums text-slate-900">
              {summary?.openCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-[10px] text-red-800/70">차단</p>
            <p className="text-lg font-bold tabular-nums text-red-950">
              {summary?.blockerCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
            <p className="text-[10px] text-amber-900/70">주의</p>
            <p className="text-lg font-bold tabular-nums text-amber-950">
              {summary?.warningCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 sm:col-span-1 lg:col-span-1">
            <p className="text-[10px] text-store-muted">현재 상태</p>
            <p className="text-sm font-bold text-slate-900">
              {summary?.currentStatus ?? "불러오는 중"}
            </p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] text-indigo-900/70">다음 작업</p>
            <p className="text-sm font-bold text-indigo-950">
              {summary?.nextWork ?? "—"}
            </p>
          </div>
        </div>
        {lastOutcome ? (
          <p className="mt-2 text-[11px] text-store-muted">최근 Outcome: {lastOutcome}</p>
        ) : null}
        {error ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.85fr)]">
        <div className="rounded-2xl border border-store-border bg-white px-3 py-3 shadow-card">
          <div>
            <h3 className="text-sm font-bold text-slate-900">차단 / 주의</h3>
            <p className="mt-0.5 text-[11px] text-store-muted">예외 케이스만 표시합니다.</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const count = filterCounts[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${
                    active
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {f.label}
                  <span
                    className={`rounded-md px-1 py-px text-[9px] font-bold tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-store-muted">
                {quality.completed
                  ? "표시할 예외 케이스가 없습니다."
                  : "품질점검 실행 후 예외가 여기에 표시됩니다."}
              </li>
            ) : (
              filtered.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            item.severity === "BLOCKER"
                              ? "bg-red-100 text-red-900"
                              : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          {item.severity === "BLOCKER" ? "차단" : "주의"}
                        </span>
                        <span className="text-[10px] font-medium text-store-muted">
                          {targetLabel(item.targetType)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs font-semibold text-slate-900">
                        {item.title}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-store-border bg-white px-4 py-3 shadow-card">
          <h3 className="text-sm font-bold text-slate-900">미리보기</h3>
          {selected ? (
            <div className="mt-3 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    selected.severity === "BLOCKER"
                      ? "bg-red-100 text-red-900"
                      : "bg-amber-100 text-amber-950"
                  }`}
                >
                  {selected.severity === "BLOCKER" ? "차단" : "주의"}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  {targetLabel(selected.targetType)}
                </span>
                <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900">
                  {statusLabel(selected.status)}
                </span>
              </div>
              <div>
                <p className="text-store-muted">제목</p>
                <p className="font-semibold text-slate-900">{selected.title}</p>
              </div>
              <div>
                <p className="text-store-muted">출처</p>
                <p className="font-semibold text-slate-900">
                  {selected.sourceLocation ?? "—"}
                </p>
              </div>
              <div
                className={`rounded-xl border px-3 py-3 ${
                  selected.severity === "BLOCKER"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="font-semibold text-slate-800">문제 설명</p>
                <p
                  className={`mt-1 whitespace-pre-wrap ${
                    selected.severity === "BLOCKER" ? "text-red-900" : "text-amber-950"
                  }`}
                >
                  {selected.description}
                </p>
              </div>
              {selected.contentPreview ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="font-semibold text-slate-800">원본 미리보기</p>
                  <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-store-muted">
                    {selected.contentPreview}
                  </p>
                </div>
              ) : null}
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
                <p className="font-semibold text-amber-950">다음 작업</p>
                <p className="mt-1 text-amber-900/80">{selected.nextAction}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTech((v) => !v)}
                className="text-[11px] font-semibold text-slate-600 underline"
              >
                {showTech ? "기술 정보 숨기기" : "기술 정보 보기"}
              </button>
              {showTech ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[10px] text-slate-700">
                  <p>caseId: {selected.id}</p>
                  <p>targetId: {selected.targetId}</p>
                  <p>inventoryItemId: {selected.inventoryItemId ?? "—"}</p>
                  <p>relativePath: {selected.relativePath ?? "—"}</p>
                  <p>searchIndex: {searchIndexStatus}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-store-muted">
              왼쪽에서 예외를 선택하면 미리보기가 표시됩니다.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-store-border bg-white px-4 py-3 shadow-card">
          <h3 className="text-sm font-bold text-slate-900">보정 액션</h3>
          <p className="mt-1 text-[11px] text-store-muted">
            FILE / STRUCTURE / CHUNK 예외 액션만 제공합니다. (Label Editor·일반 Split·의미 중복
            제외)
          </p>

          {selected && (selected.status === "OPEN" || selected.status === "APPLIED") ? (
            <div className="mt-3 space-y-2">
              {(selected.targetType === "FILE" ||
                selected.availableActions.includes("FILE_EXCLUDE")) &&
              selected.targetType === "FILE" ? (
                <label className="block text-[11px] text-store-muted">
                  제외 사유
                  <input
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-900"
                    placeholder="지식화 제외 사유"
                    disabled={busy}
                  />
                </label>
              ) : null}
              {(selected.availableActions.includes("CHUNK_MERGE") ||
                selected.availableActions.includes("STRUCTURE_MERGE")) &&
              selected.targetType !== "FILE" ? (
                <label className="block text-[11px] text-store-muted">
                  병합 대상 ID
                  <input
                    value={secondaryTargetId}
                    onChange={(e) => setSecondaryTargetId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs text-slate-900"
                    placeholder="secondaryTargetId"
                    disabled={busy}
                  />
                </label>
              ) : null}
              <ul className="space-y-2">
                {selected.availableActions.map((action) => (
                  <li key={action}>
                    <button
                      type="button"
                      disabled={busy || selected.status === "APPLIED"}
                      onClick={() =>
                        void runAction(async () => {
                          await applyAdminCorrectionCase(packId, selected.id, {
                            action,
                            reasonText: reasonText.trim() || undefined,
                            providerRequestNote:
                              action === "FILE_REQUEST_PROVIDER"
                                ? reasonText.trim() || "제공자 확인 요청"
                                : undefined,
                            secondaryTargetId: secondaryTargetId.trim() || undefined,
                          });
                        })
                      }
                      className="flex w-full min-h-[40px] items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-left text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{ACTION_LABELS[action] ?? action}</span>
                      <span className="text-[10px] font-bold text-slate-500">적용</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={busy || (summary?.appliedCount ?? 0) === 0}
              onClick={() =>
                void runAction(async () => {
                  const result = await regenerateAdminCorrection(packId);
                  setLastOutcome(result.quality.outcome);
                  onRerunQuality?.();
                })
              }
              className="flex w-full min-h-[40px] items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              재생성 → Auto Quality → Outcome
            </button>
            {selected?.status === "REGENERATED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    await verifyAdminCorrectionCase(packId, selected.id);
                  })
                }
                className="flex w-full min-h-[40px] items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-950 disabled:opacity-50"
              >
                검증 완료
              </button>
            ) : null}
            {selected?.status === "VERIFIED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void runAction(async () => {
                    await closeAdminCorrectionCase(packId, selected.id);
                  })
                }
                className="flex w-full min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 disabled:opacity-50"
              >
                케이스 종료
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onGoGeneration?.()}
              className="flex w-full min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
            >
              생성 단계로 이동
            </button>
            {generationDone ? (
              <button
                type="button"
                onClick={() => onRerunQuality?.()}
                className="flex w-full min-h-[40px] items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-950"
              >
                품질점검 재실행
              </button>
            ) : null}
            {readyForProvider ? (
              <button
                type="button"
                onClick={() => {
                  if (onGoProviderReview) onGoProviderReview();
                  else window.location.assign(`${adminReviewDetailPath(packId)}?step=publish`);
                }}
                className="flex w-full min-h-[40px] items-center justify-center rounded-xl bg-store-accent px-3 text-xs font-bold text-white"
              >
                제공자 검토 이동
              </button>
            ) : null}
            {showSearchValidationCta ? (
              <button
                type="button"
                onClick={() => onGoSearchValidation?.()}
                className="flex w-full min-h-[40px] items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-950"
              >
                서비스 검증으로 이동
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
