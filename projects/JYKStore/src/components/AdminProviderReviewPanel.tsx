"use client";

import { useMemo, useState } from "react";
import { AdminProviderSupplementPanel } from "@/components/AdminProviderSupplementPanel";
import { requestAdminProviderReviewApi } from "@/lib/admin-review-api";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import {
  isOpenProviderSupplementPhase,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";
import type { AdminWorkerZipPhase } from "@/lib/role-workspace/admin-review-rail";
import { canRequestProviderReviewHandoff } from "@/lib/store-workflow-handoff-gates-policy";
import { adminReviewDetailPath } from "@/lib/routes";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

function providerReviewStatusLabel(phase: string): string {
  switch (phase) {
    case "REQUESTED":
      return "제공자 검토 대기";
    case "CONFIRMED":
      return "제공자 확인 완료";
    case "WITHDRAWN":
      return "제공자 회수/보완요청";
    default:
      return "검토 요청 전";
  }
}

function qualityStatusLabel(quality: AdminQualityGateSnapshot): string {
  if (!quality.completed) return "품질점검 미완료";
  if (quality.hasBlockers || quality.failCount > 0) return "품질점검 차단(FAIL)";
  if (quality.hasWarnings) return "품질점검 통과(WARNING)";
  return "품질점검 통과";
}

/**
 * Workbench step3 — 제공자 검토.
 * 요청 전 관리자 확인 체크 + 보완요청 패널을 이 단계에서만 표시한다.
 */
export function AdminProviderReviewPanel({
  packId,
  detail,
  workerZipPhase,
  quality,
  providerReviewPhase,
  providerReviewRequestedAt,
  providerReviewConfirmedAt,
  supplementState,
  onChanged,
  onGoGeneration,
  onGoQuality,
  onError,
}: {
  readonly packId: string;
  readonly detail: AdminReviewDetailDto;
  readonly workerZipPhase: AdminWorkerZipPhase;
  readonly quality: AdminQualityGateSnapshot;
  readonly providerReviewPhase: string;
  readonly providerReviewRequestedAt: string | null;
  readonly providerReviewConfirmedAt: string | null;
  readonly supplementState: ProviderSupplementRequestState | null;
  readonly onChanged: () => Promise<void> | void;
  readonly onGoGeneration: () => void;
  readonly onGoQuality: () => void;
  readonly onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [checkedQuality, setCheckedQuality] = useState(false);
  const [checkedWarnings, setCheckedWarnings] = useState(false);
  const [checkedCorrectionScope, setCheckedCorrectionScope] = useState(false);

  const hasOpenSupplement = isOpenProviderSupplementPhase(supplementState?.adminPhase);

  const canRequestGate = canRequestProviderReviewHandoff({
    workerZipPhase,
    quality,
    providerReviewPhase,
    providerSupplementPhase: supplementState?.adminPhase,
  });

  const blockReasons = useMemo(() => {
    const reasons: string[] = [];
    if (hasOpenSupplement) {
      reasons.push(
        "열린 보완요청이 있습니다. 보완요청 패널에서 재검토를 요청하세요.",
      );
    }
    if (workerZipPhase !== "COMPLETED") {
      reasons.push(`지식데이터 생성이 완료되지 않았습니다. (현재: ${workerZipPhase})`);
    }
    if (!quality.completed) {
      reasons.push("품질점검을 먼저 실행·통과해야 합니다.");
    }
    if (quality.hasBlockers || quality.failCount > 0) {
      reasons.push("품질 차단 이슈(FAIL)가 있어 제공자 검토를 요청할 수 없습니다.");
    }
    if (providerReviewPhase === "REQUESTED") {
      reasons.push("이미 제공자 검토를 요청한 상태입니다.");
    }
    if (providerReviewPhase === "CONFIRMED") {
      reasons.push("제공자가 이미 확인을 완료했습니다.");
    }
    return reasons;
  }, [workerZipPhase, quality, providerReviewPhase, hasOpenSupplement]);

  const acknowledgementsReady =
    checkedQuality &&
    checkedWarnings &&
    checkedCorrectionScope &&
    (!quality.hasWarnings || checkedWarnings);

  const canSubmitRequest =
    canRequestGate &&
    !hasOpenSupplement &&
    acknowledgementsReady &&
    blockReasons.length === 0;

  const showRequestForm =
    !hasOpenSupplement &&
    (providerReviewPhase === "NONE" || providerReviewPhase === "WITHDRAWN");

  const onRequest = async () => {
    if (!canSubmitRequest || busy) return;
    setBusy(true);
    try {
      await requestAdminProviderReviewApi(packId);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "제공자 검토 요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      {hasOpenSupplement ? (
        <AdminProviderSupplementPanel
          packId={packId}
          state={supplementState}
          providerName={detail.pack.providerName}
          onChanged={onChanged}
        />
      ) : null}

      {hasOpenSupplement ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGoGeneration}
            className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
          >
            생성·품질보정으로 이동
          </button>
          <p className="w-full text-xs text-amber-900">
            제공자 보완요청이 처리되기 전에는 서비스 검증으로 진행할 수 없습니다.
          </p>
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div>
          <h2 className="text-sm font-bold text-slate-900">제공자 검토</h2>
          <p className="mt-1 text-xs text-store-muted">
            품질점검·보정 가능 범위를 확인한 뒤 제공자에게 생성 결과 검토를 요청합니다. 제공자 확인
            전에는 서비스 검증·공개로 진행할 수 없습니다.
          </p>
        </div>

        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">지식팩</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{detail.pack.name}</dd>
            <dd className="font-mono text-[11px] text-store-muted">{packId}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">제공자</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{detail.pack.providerName}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">Worker 생성</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{workerZipPhase}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">품질점검</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{qualityStatusLabel(quality)}</dd>
            <dd className="mt-0.5 text-[11px] text-store-muted">
              차단 {quality.blockers.length} · 주의 {quality.warnings.length}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">제공자 검토 상태</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {providerReviewStatusLabel(providerReviewPhase)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-store-muted">요청/확인 시각</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {formatDateTime(providerReviewConfirmedAt ?? providerReviewRequestedAt)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:col-span-2">
            <dt className="text-store-muted">보완요청</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {hasOpenSupplement
                ? `접수됨 (${supplementState?.adminPhase})`
                : "없음"}
            </dd>
          </div>
        </dl>

        {quality.blockers.length > 0 ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-900">
            <p className="font-semibold">차단 이슈</p>
            <ul className="mt-1 list-disc pl-4">
              {quality.blockers.slice(0, 5).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onGoQuality}
              className="mt-2 text-[11px] font-bold underline"
            >
              생성·품질보정에서 확인
            </button>
          </div>
        ) : null}

        {showRequestForm ? (
          <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-3">
            <p className="text-xs font-bold text-indigo-950">제공자 검토 요청 전 확인</p>
            <label className="flex items-start gap-2 text-xs text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checkedQuality}
                onChange={(e) => setCheckedQuality(e.target.checked)}
              />
              <span>품질점검 결과를 확인했습니다.</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checkedWarnings}
                onChange={(e) => setCheckedWarnings(e.target.checked)}
              />
              <span>
                WARNING/주의 이슈를 확인했습니다
                {quality.hasWarnings ? " (현재 WARNING 있음)" : " (현재 WARNING 없음)"}.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checkedCorrectionScope}
                onChange={(e) => setCheckedCorrectionScope(e.target.checked)}
              />
              <span>
                보정 가능 범위를 확인했습니다. Chunk 개별 수정/부분 재생성은 현재 비활성이며, 필요 시
                Worker 전체 재생성으로 처리합니다.
              </span>
            </label>

            {blockReasons.length > 0 ? (
              <ul className="list-disc pl-4 text-xs text-amber-950">
                {blockReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}

            <button
              type="button"
              disabled={busy || !canSubmitRequest}
              onClick={() => void onRequest()}
              className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "요청 중…" : "제공자 검토 요청"}
            </button>
            {!canSubmitRequest && blockReasons.length === 0 ? (
              <p className="text-[11px] text-store-muted">
                위 확인 항목을 모두 체크해야 요청할 수 있습니다.
              </p>
            ) : null}
          </div>
        ) : null}

        {providerReviewPhase === "REQUESTED" ? (
          <p className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-950">
            제공자 검토 대기 중입니다. 제공자가 확인하면 서비스 검증으로 진행하세요.
          </p>
        ) : null}

        {providerReviewPhase === "CONFIRMED" && !hasOpenSupplement ? (
          <a
            href={`${adminReviewDetailPath(packId)}?step=searchValidation`}
            className="inline-flex min-h-[40px] items-center rounded-xl bg-slate-900 px-3 text-xs font-bold text-white"
          >
            서비스 검증으로 이동
          </a>
        ) : null}
      </section>
    </div>
  );
}
