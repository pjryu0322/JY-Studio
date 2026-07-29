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
 * P5.1A Compact Exception-only Correction Workbench (`?step=correction`).
 * Dense list + tooltip help; no full chunk editor; workflow unchanged.
 */

type SeverityFilter = "all" | "BLOCKER" | "WARNING";

const FILTERS: { id: SeverityFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "BLOCKER", label: "Blocker" },
  { id: "WARNING", label: "Warning" },
];

const ACTION_LABELS: Record<string, string> = {
  FILE_EXCLUDE: "Exclude",
  FILE_REQUEST_PROVIDER: "Provider 확인",
  STRUCTURE_DELETE: "Delete",
  STRUCTURE_MERGE: "Merge",
  CHUNK_DELETE: "Delete",
  CHUNK_MERGE: "Merge",
};

const ACTION_HINTS: Record<string, string> = {
  FILE_EXCLUDE: "이 파일을 지식화 대상에서 제외합니다",
  FILE_REQUEST_PROVIDER: "제공자에게 확인·보완을 요청합니다",
  STRUCTURE_DELETE: "해당 구조의 활성 항목을 제거합니다",
  STRUCTURE_MERGE: "선택한 구조를 대상에 통합합니다",
  CHUNK_DELETE: "해당 청크를 검색에서 제외합니다",
  CHUNK_MERGE: "선택한 청크를 대상에 통합합니다",
};

const PRIMARY_ACTIONS = new Set([
  "FILE_EXCLUDE",
  "STRUCTURE_MERGE",
  "STRUCTURE_DELETE",
  "CHUNK_MERGE",
  "CHUNK_DELETE",
]);

function statusLabel(status: AdminCorrectionCase["status"]): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "APPLIED":
      return "Applied";
    case "REGENERATED":
      return "Regen";
    case "VERIFIED":
      return "Verified";
    case "CLOSED":
      return "Done";
    default:
      return status;
  }
}

function recommendedActionLabel(caseRow: AdminCorrectionCase): string {
  const action = caseRow.recommendedAction;
  if (!action) return "—";
  return ACTION_LABELS[action] ?? action;
}

function InfoHint({ tip }: { tip: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500"
      title={tip}
      aria-label={tip}
    >
      ⓘ
    </span>
  );
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
        setError(err instanceof Error ? err.message : "동기화 실패");
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

  const filterCounts = useMemo(
    () => ({
      all: cases.length,
      BLOCKER: cases.filter((c) => c.severity === "BLOCKER").length,
      WARNING: cases.filter((c) => c.severity === "WARNING").length,
    }),
    [cases],
  );

  const primaryActions = useMemo(() => {
    if (!selected) return [] as string[];
    return selected.availableActions.filter((a) => PRIMARY_ACTIONS.has(a));
  }, [selected]);

  const moreActions = useMemo(() => {
    if (!selected) return [] as string[];
    return selected.availableActions.filter((a) => !PRIMARY_ACTIONS.has(a));
  }, [selected]);

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      {/* First screen: Blocker / Warning / Open / Next only */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-store-border bg-white px-2.5 py-1.5 text-xs">
        <span className="font-bold text-slate-900" title="예외 보정 Workbench">
          Correction
        </span>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="text-slate-500 hover:text-slate-800"
          title="도움말"
          aria-label="도움말"
        >
          ⓘ
        </button>
        <span className="text-red-700" title="차단 예외">
          Blocker <b className="tabular-nums">{summary?.blockerCount ?? 0}</b>
        </span>
        <span className="text-amber-700" title="주의 예외">
          Warning <b className="tabular-nums">{summary?.warningCount ?? 0}</b>
        </span>
        <span className="text-slate-700" title="미처리 케이스">
          Open <b className="tabular-nums">{summary?.openCount ?? 0}</b>
        </span>
        <span className="min-w-0 flex-1 truncate text-slate-600" title={summary?.nextWork ?? ""}>
          Next: {summary?.nextWork ?? "—"}
        </span>
        {lastOutcome ? (
          <span
            className={
              lastOutcome === "SUCCEEDED" || lastOutcome === "SUCCEEDED_WITH_WARNINGS"
                ? "text-emerald-700"
                : lastOutcome === "CORRECTION_REQUIRED"
                  ? "text-red-700"
                  : "text-slate-600"
            }
            title="최근 재생성 Outcome"
          >
            {lastOutcome}
          </span>
        ) : null}
        <button
          type="button"
          disabled={busy}
          title="품질 결과에서 예외 케이스 동기화"
          onClick={() =>
            void runAction(async () => {
              const data = await syncAdminCorrectionWorkbench(packId);
              setSummary(data.summary);
              setCases(data.cases);
            })
          }
          className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
        >
          Sync
        </button>
      </div>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900">{error}</p>
      ) : null}

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.85fr)]">
        {/* Dense one-line case list */}
        <div className="border border-store-border bg-white">
          <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  title={f.label}
                  onClick={() => setFilter(f.id)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                  <span className="ml-1 tabular-nums opacity-80">{filterCounts[f.id]}</span>
                </button>
              );
            })}
          </div>
          <div className="max-h-[24rem] overflow-auto">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-50 text-[10px] text-slate-500">
                <tr>
                  <th className="px-2 py-1 font-semibold">Severity</th>
                  <th className="px-2 py-1 font-semibold">Case</th>
                  <th className="px-2 py-1 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-3 text-store-muted">
                      {quality.completed ? "예외 없음" : "품질점검 후 표시"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const active = selected?.id === item.id;
                    const done = item.status === "CLOSED" || item.status === "VERIFIED";
                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedId(item.id);
                          setShowAdvanced(false);
                          setMoreOpen(false);
                          setReasonText("");
                          setSecondaryTargetId(item.secondaryTargetId ?? "");
                        }}
                        className={`cursor-pointer border-t border-slate-100 ${
                          active ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                        title={item.description.slice(0, 200)}
                      >
                        <td className="whitespace-nowrap px-2 py-1 align-middle">
                          <span
                            className={`font-bold ${
                              done
                                ? "text-emerald-700"
                                : item.severity === "BLOCKER"
                                  ? "text-red-700"
                                  : "text-amber-700"
                            }`}
                          >
                            {done ? "DONE" : item.severity}
                          </span>
                        </td>
                        <td className="max-w-[12rem] truncate px-2 py-1 align-middle font-medium text-slate-900">
                          {item.title}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 align-middle text-slate-600">
                          {recommendedActionLabel(item)}
                          <span className="ml-1 text-[10px] text-slate-400">
                            · {statusLabel(item.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail: preview / problem / recommended — tech hidden */}
        <div className="border border-store-border bg-white px-2.5 py-2 text-xs">
          {selected ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`font-bold ${
                    selected.severity === "BLOCKER" ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  [{selected.severity}]
                </span>
                <span className="font-semibold text-slate-900">{selected.title}</span>
                <InfoHint tip={selected.nextAction} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500">문제</p>
                <p className="mt-0.5 max-h-28 overflow-y-auto whitespace-pre-wrap text-slate-800">
                  {selected.description}
                </p>
              </div>
              {selected.contentPreview ? (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500">원본 미리보기</p>
                  <p className="mt-0.5 max-h-32 overflow-y-auto whitespace-pre-wrap text-store-muted">
                    {selected.contentPreview}
                  </p>
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold text-slate-500">권장 액션</p>
                <InfoHint tip={ACTION_HINTS[selected.recommendedAction ?? ""] ?? selected.nextAction} />
                <span className="font-semibold text-slate-900">
                  {recommendedActionLabel(selected)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-[10px] font-semibold text-slate-500 underline"
                title="내부 ID·경로 등"
              >
                {showAdvanced ? "고급 숨기기" : "고급 보기"}
              </button>
              {showAdvanced ? (
                <div className="border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-600">
                  <p>caseId: {selected.id}</p>
                  <p>targetId: {selected.targetId}</p>
                  <p>secondary: {selected.secondaryTargetId ?? "—"}</p>
                  <p>inventoryItemId: {selected.inventoryItemId ?? "—"}</p>
                  <p>path: {selected.relativePath ?? "—"}</p>
                  <p>searchIndex: {searchIndexStatus}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-store-muted">케이스 선택</p>
          )}
        </div>

        {/* Compact actions: Exclude / Merge / Delete / Regenerate + More */}
        <div className="border border-store-border bg-white px-2.5 py-2">
          {selected && selected.status === "OPEN" ? (
            <div className="space-y-1.5">
              {selected.targetType === "FILE" ? (
                <input
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900"
                  placeholder="제외 사유"
                  title="지식화 제외 또는 제공자 요청 사유"
                  disabled={busy}
                />
              ) : null}
              {(selected.availableActions.includes("CHUNK_MERGE") ||
                selected.availableActions.includes("STRUCTURE_MERGE")) &&
              selected.targetType !== "FILE" ? (
                <input
                  value={secondaryTargetId}
                  onChange={(e) => setSecondaryTargetId(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-900"
                  placeholder="병합 대상 ID"
                  title="통합할 대상 ID"
                  disabled={busy}
                />
              ) : null}
              <div className="flex flex-wrap gap-1">
                {primaryActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={busy}
                    title={ACTION_HINTS[action] ?? action}
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
                    className="min-h-[32px] rounded border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-900 disabled:opacity-50"
                  >
                    {ACTION_LABELS[action] ?? action}
                  </button>
                ))}
                {moreActions.length > 0 ? (
                  <div className="relative">
                    <button
                      type="button"
                      disabled={busy}
                      title="추가 액션"
                      onClick={() => setMoreOpen((v) => !v)}
                      className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 disabled:opacity-50"
                    >
                      More
                    </button>
                    {moreOpen ? (
                      <ul className="absolute right-0 z-10 mt-1 min-w-[9rem] border border-slate-200 bg-white py-1 shadow-sm">
                        {moreActions.map((action) => (
                          <li key={action}>
                            <button
                              type="button"
                              disabled={busy}
                              title={ACTION_HINTS[action] ?? action}
                              onClick={() => {
                                setMoreOpen(false);
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
                                });
                              }}
                              className="block w-full px-2 py-1 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {ACTION_LABELS[action] ?? action}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : selected ? (
            <p className="text-[11px] text-slate-500" title={selected.nextAction}>
              {statusLabel(selected.status)} · {selected.nextAction}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
            <button
              type="button"
              disabled={busy || (summary?.appliedCount ?? 0) === 0}
              title="보정 반영 후 재생성·Auto Quality·Outcome 갱신"
              onClick={() =>
                void runAction(async () => {
                  const result = await regenerateAdminCorrection(packId);
                  setLastOutcome(result.quality.outcome);
                  onRerunQuality?.();
                })
              }
              className="min-h-[32px] rounded bg-slate-900 px-2.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              Regenerate
            </button>
            {selected?.status === "REGENERATED" ? (
              <button
                type="button"
                disabled={busy}
                title="품질·Outcome 확인 후 검증"
                onClick={() =>
                  void runAction(async () => {
                    await verifyAdminCorrectionCase(packId, selected.id);
                  })
                }
                className="min-h-[32px] rounded border border-emerald-300 px-2 text-[11px] font-bold text-emerald-800 disabled:opacity-50"
              >
                Verify
              </button>
            ) : null}
            {selected?.status === "VERIFIED" ? (
              <button
                type="button"
                disabled={busy}
                title="케이스 종료"
                onClick={() =>
                  void runAction(async () => {
                    await closeAdminCorrectionCase(packId, selected.id);
                  })
                }
                className="min-h-[32px] rounded border border-slate-300 px-2 text-[11px] font-bold text-slate-800 disabled:opacity-50"
              >
                Close
              </button>
            ) : null}
            <button
              type="button"
              title="생성 단계"
              onClick={() => onGoGeneration?.()}
              className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
            >
              Generation
            </button>
            {generationDone ? (
              <button
                type="button"
                title="품질점검 재실행"
                onClick={() => onRerunQuality?.()}
                className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
              >
                Quality
              </button>
            ) : null}
            {readyForProvider ? (
              <button
                type="button"
                title="제공자 검토"
                onClick={() => {
                  if (onGoProviderReview) onGoProviderReview();
                  else window.location.assign(`${adminReviewDetailPath(packId)}?step=publish`);
                }}
                className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
              >
                Provider
              </button>
            ) : null}
            {showSearchValidationCta ? (
              <button
                type="button"
                title="서비스 검증"
                onClick={() => onGoSearchValidation?.()}
                className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
              >
                Service
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {helpOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20" role="dialog" aria-modal="true">
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="닫기"
            onClick={() => setHelpOpen(false)}
          />
          <aside className="h-full w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-4 text-xs shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Correction 도움말</h3>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="text-slate-500 hover:text-slate-800"
                title="닫기"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-slate-700">
              <li>자동 품질점검 후 남은 예외만 처리합니다.</li>
              <li>Exclude / Merge / Delete 적용 → Regenerate → Auto Quality → Outcome.</li>
              <li>상태: Open → Applied → Regenerated → Verified → Done.</li>
              <li>내부 ID·JSON·Inventory ID는 고급 보기에서만 표시됩니다.</li>
              <li>Label Editor · Split · Semantic Duplicate는 이번 단계에서 제외입니다.</li>
            </ul>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
