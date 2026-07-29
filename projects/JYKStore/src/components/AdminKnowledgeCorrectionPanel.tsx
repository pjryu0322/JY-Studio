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
import {
  actionUiLabel,
  canRunPrimaryApply,
  CORRECTION_ACTION_HINT_UI,
  CORRECTION_WORKBENCH_GRID_CLASS,
  filterCorrectionCases,
  outcomeUiLabel,
  resolveSelectedCorrectionCase,
  severityUiLabel,
  shouldShowAdvancedDetails,
  shouldShowMoreMenu,
  splitCorrectionActions,
  statusUiLabel,
} from "@/lib/correction/correction-ui-labels";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import { adminReviewDetailPath } from "@/lib/routes";
import { UiTooltip } from "@/components/UiTooltip";

/**
 * P5.1B Compact Correction Workbench — Korean UI labels + accessible tooltips.
 * Workflow / API / data model unchanged.
 */

type SeverityFilter = "all" | "BLOCKER" | "WARNING";

const FILTERS: { id: SeverityFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "BLOCKER", label: "차단" },
  { id: "WARNING", label: "주의" },
];

function InfoHint({ tip }: { tip: string }) {
  return (
    <UiTooltip content={tip} side="bottom">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500"
        aria-label={tip}
      >
        ⓘ
      </button>
    </UiTooltip>
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

  const filtered = useMemo(
    () => filterCorrectionCases(cases, filter),
    [cases, filter],
  );

  const selected = useMemo(
    () =>
      resolveSelectedCorrectionCase({
        cases,
        filtered,
        selectedId,
      }),
    [cases, filtered, selectedId],
  );

  const filterCounts = useMemo(
    () => ({
      all: cases.length,
      BLOCKER: cases.filter((c) => c.severity === "BLOCKER").length,
      WARNING: cases.filter((c) => c.severity === "WARNING").length,
    }),
    [cases],
  );

  const { primary: primaryActions, more: moreActions } = useMemo(
    () => splitCorrectionActions(selected?.availableActions ?? []),
    [selected],
  );

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-store-border bg-white px-2.5 py-1.5 text-xs">
        <UiTooltip content="예외 보정 작업대">
          <span className="font-bold text-slate-900">보정</span>
        </UiTooltip>
        <UiTooltip content="도움말 열기">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-slate-500 hover:text-slate-800"
            aria-label="도움말"
          >
            ⓘ
          </button>
        </UiTooltip>
        <UiTooltip content="차단 예외 건수">
          <span className="text-red-700">
            차단 <b className="tabular-nums">{summary?.blockerCount ?? 0}</b>
          </span>
        </UiTooltip>
        <UiTooltip content="주의 예외 건수">
          <span className="text-amber-700">
            주의 <b className="tabular-nums">{summary?.warningCount ?? 0}</b>
          </span>
        </UiTooltip>
        <UiTooltip content="미처리 케이스 건수">
          <span className="text-slate-700">
            미처리 <b className="tabular-nums">{summary?.openCount ?? 0}</b>
          </span>
        </UiTooltip>
        <UiTooltip content={summary?.nextWork ?? "다음 작업"}>
          <span className="min-w-0 flex-1 truncate text-slate-600">
            다음: {summary?.nextWork ?? "—"}
          </span>
        </UiTooltip>
        {lastOutcome ? (
          <UiTooltip content="최근 재생성 결과">
            <span
              className={
                lastOutcome === "SUCCEEDED" || lastOutcome === "SUCCEEDED_WITH_WARNINGS"
                  ? "text-emerald-700"
                  : lastOutcome === "CORRECTION_REQUIRED"
                    ? "text-red-700"
                    : "text-slate-600"
              }
            >
              {outcomeUiLabel(lastOutcome)}
            </span>
          </UiTooltip>
        ) : null}
        <UiTooltip content="품질 결과에서 예외 케이스 동기화" enableTap={false}>
          <button
            type="button"
            disabled={busy}
            aria-label="품질 결과에서 예외 케이스 동기화"
            onClick={() =>
              void runAction(async () => {
                const data = await syncAdminCorrectionWorkbench(packId);
                setSummary(data.summary);
                setCases(data.cases);
              })
            }
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
          >
            동기화
          </button>
        </UiTooltip>
      </div>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900">{error}</p>
      ) : null}

      <div className={CORRECTION_WORKBENCH_GRID_CLASS}>
        <div className="border border-store-border bg-white">
          <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <UiTooltip key={f.id} content={`${f.label} 필터`}>
                  <button
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                    <span className="ml-1 tabular-nums opacity-80">{filterCounts[f.id]}</span>
                  </button>
                </UiTooltip>
              );
            })}
          </div>
          <div className="max-h-[24rem] overflow-auto">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-50 text-[10px] text-slate-500">
                <tr>
                  <th className="px-2 py-1 font-semibold">심각도</th>
                  <th className="px-2 py-1 font-semibold">케이스</th>
                  <th className="px-2 py-1 font-semibold">액션</th>
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
                        data-correction-case-id={item.id}
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
                      >
                        <td className="whitespace-nowrap px-2 py-1 align-middle">
                          <UiTooltip content={item.description.slice(0, 200)}>
                            <span
                              className={`font-bold ${
                                done
                                  ? "text-emerald-700"
                                  : item.severity === "BLOCKER"
                                    ? "text-red-700"
                                    : "text-amber-700"
                              }`}
                            >
                              {severityUiLabel(item.severity, done)}
                            </span>
                          </UiTooltip>
                        </td>
                        <td className="max-w-[12rem] truncate px-2 py-1 align-middle font-medium text-slate-900">
                          {item.title}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 align-middle text-slate-600">
                          {actionUiLabel(item.recommendedAction)}
                          <span className="ml-1 text-[10px] text-slate-400">
                            · {statusUiLabel(item.status)}
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

        <div className="border border-store-border bg-white px-2.5 py-2 text-xs">
          {selected ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`font-bold ${
                    selected.severity === "BLOCKER" ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  [{severityUiLabel(selected.severity)}]
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
                <InfoHint
                  tip={
                    CORRECTION_ACTION_HINT_UI[selected.recommendedAction ?? ""] ??
                    selected.nextAction
                  }
                />
                <span className="font-semibold text-slate-900">
                  {actionUiLabel(selected.recommendedAction)}
                </span>
              </div>
              <UiTooltip content="내부 ID·경로 등 기술 정보">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-[10px] font-semibold text-slate-500 underline"
                  data-testid="correction-advanced-toggle"
                >
                  {showAdvanced ? "고급 숨기기" : "고급 보기"}
                </button>
              </UiTooltip>
              {shouldShowAdvancedDetails(showAdvanced) ? (
                <div
                  className="border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-600"
                  data-testid="correction-advanced-panel"
                >
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

        <div className="border border-store-border bg-white px-2.5 py-2">
          {selected && canRunPrimaryApply(selected.status) ? (
            <div className="space-y-1.5">
              {selected.targetType === "FILE" ? (
                <UiTooltip content="지식화 제외 또는 제공자 요청 사유">
                  <input
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900"
                    placeholder="제외 사유"
                    disabled={busy}
                  />
                </UiTooltip>
              ) : null}
              {(selected.availableActions.includes("CHUNK_MERGE") ||
                selected.availableActions.includes("STRUCTURE_MERGE")) &&
              selected.targetType !== "FILE" ? (
                <UiTooltip content="통합할 대상 ID">
                  <input
                    value={secondaryTargetId}
                    onChange={(e) => setSecondaryTargetId(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-900"
                    placeholder="병합 대상 ID"
                    disabled={busy}
                  />
                </UiTooltip>
              ) : null}
              <div className="flex flex-wrap gap-1">
                {primaryActions.map((action) => (
                  <UiTooltip
                    key={action}
                    content={CORRECTION_ACTION_HINT_UI[action] ?? action}
                    enableTap={false}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      data-correction-primary-action={action}
                      aria-label={CORRECTION_ACTION_HINT_UI[action] ?? actionUiLabel(action)}
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
                      {actionUiLabel(action)}
                    </button>
                  </UiTooltip>
                ))}
                {moreActions.length > 0 ? (
                  <div className="relative">
                    <UiTooltip content="추가 액션">
                      <button
                        type="button"
                        disabled={busy}
                        data-testid="correction-more-toggle"
                        onClick={() => setMoreOpen((v) => !v)}
                        className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 disabled:opacity-50"
                      >
                        더보기
                      </button>
                    </UiTooltip>
                    {shouldShowMoreMenu(moreActions, moreOpen) ? (
                      <ul
                        className="absolute right-0 z-10 mt-1 min-w-[9rem] border border-slate-200 bg-white py-1 shadow-sm"
                        data-testid="correction-more-menu"
                      >
                        {moreActions.map((action) => (
                          <li key={action}>
                            <UiTooltip
                              content={CORRECTION_ACTION_HINT_UI[action] ?? action}
                              enableTap={false}
                            >
                              <button
                                type="button"
                                disabled={busy}
                                aria-label={
                                  CORRECTION_ACTION_HINT_UI[action] ?? actionUiLabel(action)
                                }
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
                                {actionUiLabel(action)}
                              </button>
                            </UiTooltip>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : selected ? (
            <UiTooltip content={selected.nextAction}>
              <p className="text-[11px] text-slate-500">
                {statusUiLabel(selected.status)} · {selected.nextAction}
              </p>
            </UiTooltip>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
            <UiTooltip content="보정 반영 후 재생성·자동 품질·결과 갱신" enableTap={false}>
              <button
                type="button"
                disabled={busy || (summary?.appliedCount ?? 0) === 0}
                aria-label="보정 반영 후 재생성·자동 품질·결과 갱신"
                onClick={() =>
                  void runAction(async () => {
                    const result = await regenerateAdminCorrection(packId);
                    setLastOutcome(result.quality.outcome);
                    onRerunQuality?.();
                  })
                }
                className="min-h-[32px] rounded bg-slate-900 px-2.5 text-[11px] font-bold text-white disabled:opacity-50"
              >
                재생성
              </button>
            </UiTooltip>
            {selected?.status === "REGENERATED" ? (
              <UiTooltip content="품질·결과 확인 후 검증" enableTap={false}>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="품질·결과 확인 후 검증"
                  onClick={() =>
                    void runAction(async () => {
                      await verifyAdminCorrectionCase(packId, selected.id);
                    })
                  }
                  className="min-h-[32px] rounded border border-emerald-300 px-2 text-[11px] font-bold text-emerald-800 disabled:opacity-50"
                >
                  검증
                </button>
              </UiTooltip>
            ) : null}
            {selected?.status === "VERIFIED" ? (
              <UiTooltip content="케이스 종료" enableTap={false}>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="케이스 종료"
                  onClick={() =>
                    void runAction(async () => {
                      await closeAdminCorrectionCase(packId, selected.id);
                    })
                  }
                  className="min-h-[32px] rounded border border-slate-300 px-2 text-[11px] font-bold text-slate-800 disabled:opacity-50"
                >
                  종료
                </button>
              </UiTooltip>
            ) : null}
            <UiTooltip content="생성 단계로 이동" enableTap={false}>
              <button
                type="button"
                aria-label="생성 단계로 이동"
                onClick={() => onGoGeneration?.()}
                className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
              >
                생성
              </button>
            </UiTooltip>
            {generationDone ? (
              <UiTooltip content="품질점검 재실행" enableTap={false}>
                <button
                  type="button"
                  aria-label="품질점검 재실행"
                  onClick={() => onRerunQuality?.()}
                  className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
                >
                  품질
                </button>
              </UiTooltip>
            ) : null}
            {readyForProvider ? (
              <UiTooltip content="제공자 검토로 이동" enableTap={false}>
                <button
                  type="button"
                  aria-label="제공자 검토로 이동"
                  onClick={() => {
                    if (onGoProviderReview) onGoProviderReview();
                    else window.location.assign(`${adminReviewDetailPath(packId)}?step=publish`);
                  }}
                  className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
                >
                  제공자
                </button>
              </UiTooltip>
            ) : null}
            {showSearchValidationCta ? (
              <UiTooltip content="서비스 검증으로 이동" enableTap={false}>
                <button
                  type="button"
                  aria-label="서비스 검증으로 이동"
                  onClick={() => onGoSearchValidation?.()}
                  className="min-h-[32px] rounded border border-slate-200 px-2 text-[11px] font-semibold text-slate-600"
                >
                  서비스
                </button>
              </UiTooltip>
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
              <h3 className="text-sm font-bold text-slate-900">보정 도움말</h3>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="text-slate-500 hover:text-slate-800"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-slate-700">
              <li>자동 품질점검 후 남은 예외만 처리합니다.</li>
              <li>제외·통합·삭제 적용 → 재생성 → 자동 품질 → 결과.</li>
              <li>상태: 미처리 → 적용 → 재생성 → 검증 → 완료.</li>
              <li>내부 ID·JSON·인벤토리 ID는 고급 보기에서만 표시됩니다.</li>
              <li>라벨 편집·분리·의미 중복 삭제는 이번 단계에서 제외입니다.</li>
            </ul>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
