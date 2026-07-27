"use client";

import { useMemo, useState } from "react";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  buildCorrectionQueueIssues,
  type CorrectionQueueIssue,
  type CorrectionQueueIssueCategory,
  type CorrectionQueueIssueSeverity,
} from "@/lib/admin-correction-queue-issues";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import { adminReviewDetailPath } from "@/lib/routes";

/**
 * Admin correction workbench (`?step=correction`).
 *
 * History policy (schema not added in this MVP):
 * - Do not delete original knowledgeUnitId / chunkId / searchDataId.
 * - Merge / split / search-exclude / keep-independent / provider-request must be auditable later.
 * - Store before/after snapshot, actor, time, reason, reindex flag in a follow-up revision model.
 * - Search should use corrected results only (merged/excluded originals omitted).
 * - After correction, re-run quality and possibly reindex — surfaced in UI below.
 *
 * Merge/split APIs are not wired yet (disabled CTAs). Live paths: regenerate, re-quality, provider review.
 */

type IssueFilter = "all" | "block" | "warning";

const FILTERS: { id: IssueFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "block", label: "차단" },
  { id: "warning", label: "주의" },
];

const DISABLED_ACTIONS: { id: string; label: string; hint: string }[] = [
  {
    id: "merge-parent",
    label: "부모 지식단위와 병합",
    hint: "준비 중 — 병합 API 후속",
  },
  {
    id: "merge-neighbor",
    label: "인접 지식단위와 병합",
    hint: "준비 중 — 병합 API 후속",
  },
  {
    id: "merge-prev-chunk",
    label: "이전 Chunk와 병합",
    hint: "준비 중 — Chunk 병합 API 후속",
  },
  {
    id: "merge-next-chunk",
    label: "다음 Chunk와 병합",
    hint: "준비 중 — Chunk 병합 API 후속",
  },
  {
    id: "split-chunk",
    label: "Chunk 분리",
    hint: "준비 중 — 분리 API 후속",
  },
  {
    id: "exclude-search",
    label: "검색 제외",
    hint: "현재 비활성 (API 410)",
  },
  {
    id: "keep-independent",
    label: "독립 유지",
    hint: "준비 중 — 이력 모델 후속",
  },
  {
    id: "request-provider",
    label: "제공자 보완요청",
    hint: "제공자 검토 단계에서 요청",
  },
];

function severityLabel(severity: CorrectionQueueIssueSeverity): string {
  if (severity === "block") return "차단";
  return "주의";
}

function categoryLabel(category: CorrectionQueueIssueCategory): string {
  if (category === "knowledgeUnit") return "지식단위";
  if (category === "chunk") return "Chunk";
  if (category === "searchData") return "검색데이터";
  if (category === "provider") return "제공자";
  if (category === "sourceDocument") return "원천문서";
  return "기타";
}

function countForFilter(issues: readonly CorrectionQueueIssue[], id: IssueFilter): number {
  if (id === "all") return issues.length;
  return issues.filter((i) => i.severity === id).length;
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
}) {
  const generationDone = workerZipPhase === "COMPLETED";
  const readyForProvider =
    generationDone && quality.completed && !quality.hasBlockers && quality.failCount === 0;
  const showSearchValidationCta =
    readyForProvider && providerReviewPhase === "CONFIRMED";

  const issues = useMemo(
    () => buildCorrectionQueueIssues(quality, detail),
    [detail, quality],
  );
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterCounts = useMemo(() => {
    const counts = {} as Record<IssueFilter, number>;
    for (const f of FILTERS) {
      counts[f.id] = countForFilter(issues, f.id);
    }
    return counts;
  }, [issues]);

  const filtered = useMemo(() => {
    if (filter === "all") return issues;
    return issues.filter((issue) => issue.severity === filter);
  }, [filter, issues]);

  const selected =
    filtered.find((i) => i.id === selectedId) ??
    issues.find((i) => i.id === selectedId) ??
    filtered[0] ??
    null;

  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.85fr)]">
        <div className="rounded-2xl border border-store-border bg-white px-3 py-3 shadow-card">
          <div>
            <h3 className="text-sm font-bold text-slate-900">보정 큐</h3>
            <p className="mt-0.5 text-[11px] text-store-muted">
              품질점검 차단 이슈와 원천 검증 WARNING 문서를 포함한 주의 이슈입니다.
            </p>
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
                  ? "표시할 차단·주의 이슈가 없습니다."
                  : "품질점검 실행 후 차단·주의 이슈가 여기에 표시됩니다."}
              </li>
            ) : (
              filtered.map((issue) => {
                const active = selected?.id === issue.id;
                return (
                  <li key={issue.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(issue.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            issue.severity === "block"
                              ? "bg-red-100 text-red-900"
                              : "bg-amber-100 text-amber-950"
                          }`}
                        >
                          {severityLabel(issue.severity)}
                        </span>
                        <span className="text-[10px] font-medium text-store-muted">
                          {categoryLabel(issue.category)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-xs font-semibold text-slate-900">
                        {issue.title}
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
                    selected.severity === "block"
                      ? "bg-red-100 text-red-900"
                      : "bg-amber-100 text-amber-950"
                  }`}
                >
                  {severityLabel(selected.severity)}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  {categoryLabel(selected.category)}
                </span>
              </div>
              <div>
                <p className="text-store-muted">제목</p>
                <p className="font-semibold text-slate-900">{selected.title}</p>
              </div>
              <div>
                <p className="text-store-muted">출처</p>
                <p className="font-semibold text-slate-900">{selected.sourceLocation}</p>
              </div>
              <div
                className={`rounded-xl border px-3 py-3 ${
                  selected.severity === "block"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <p className="font-semibold text-slate-800">이슈 내용</p>
                <p
                  className={`mt-1 whitespace-pre-wrap ${
                    selected.severity === "block" ? "text-red-900" : "text-amber-950"
                  }`}
                >
                  {selected.raw}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-store-muted">심각도</p>
                  <p className="font-semibold">{severityLabel(selected.severity)}</p>
                </div>
                <div>
                  <p className="text-store-muted">대상 ID</p>
                  <p className="font-mono text-[11px]">
                    {selected.targetId ?? "미확인 (품질 메시지에 ID 없음)"}
                  </p>
                </div>
              </div>
              {selected.contentPreview ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="font-semibold text-slate-800">원천 문서 미리보기</p>
                  <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-store-muted">
                    {selected.contentPreview}
                  </p>
                </div>
              ) : null}
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
                <p className="font-semibold text-amber-950">추천 조치</p>
                <p className="mt-1 text-amber-900/80">{selected.recommendedAction}</p>
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">보정 대상 미리보기</p>
                <p className="mt-1 text-store-muted">
                  지식단위/Chunk 원문·병합 후보는 보정 API 연동 후 표시됩니다. 검색 반영:{" "}
                  {searchIndexStatus}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-store-muted">
              왼쪽 보정 큐에서 이슈를 선택하면 세부 내용이 여기에 표시됩니다.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-store-border bg-white px-4 py-3 shadow-card">
          <h3 className="text-sm font-bold text-slate-900">보정 액션</h3>
          <p className="mt-1 text-[11px] text-store-muted">
            선택 이슈에 대한 조치입니다. 병합·분리는 준비 중이며, 재생성/재점검/단계 이동은
            사용 가능합니다.
          </p>
          <ul className="mt-3 space-y-2">
            {DISABLED_ACTIONS.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  disabled
                  title={action.hint}
                  className="flex w-full min-h-[40px] cursor-not-allowed items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-400"
                >
                  <span>{action.label}</span>
                  <span className="text-[10px] font-bold">준비 중</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => onGoGeneration?.()}
              className="flex w-full min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
            >
              전체 재생성으로 이동
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
                  else window.location.assign(`${adminReviewDetailPath(packId)}?step=providerConfirm`);
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
