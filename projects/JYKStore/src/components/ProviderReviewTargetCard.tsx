"use client";

import { useCallback, useState } from "react";
import { ProviderGenerationReviewPanel } from "@/components/ProviderGenerationReviewPanel";
import type { ProviderPackDetailDto, ProviderPackListItemDto } from "@/lib/provider-pack-dto";
import { fetchProviderPack } from "@/lib/provider-center-api";

/**
 * Review-target inbox card: expands inline review workbench without leaving the list.
 */
export function ProviderReviewTargetCard({
  pack,
  onChanged,
}: {
  readonly pack: ProviderPackListItemDto;
  readonly onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProviderPackDetailDto | null>(null);

  const versionLabel =
    pack.progress?.workingVersion &&
    pack.progress.workingVersion !== pack.progress.publishedVersion
      ? `작업 ${pack.progress.workingVersion}`
      : pack.progress?.publishedVersion
        ? `공개 ${pack.progress.publishedVersion}`
        : pack.progress?.workingVersion
          ? `v${pack.progress.workingVersion}`
          : null;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProviderPack(pack.packId);
      setDetail(res.pack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검토 내용을 불러오지 못했습니다.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [pack.packId]);

  const toggleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!detail) {
      await loadDetail();
    }
  };

  const handleChanged = async () => {
    await loadDetail();
    await onChanged();
  };

  const phase =
    detail?.providerReviewPhase === "REQUESTED" ||
    detail?.providerReviewPhase === "CONFIRMED" ||
    detail?.providerReviewPhase === "WITHDRAWN"
      ? detail.providerReviewPhase
      : "REQUESTED";

  return (
    <li className="rounded-xl border border-store-border bg-white px-3 py-2 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{pack.name}</p>
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
              검토대상
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-store-muted">
            {[versionLabel, open ? null : "품질 요약은 아래에서 확인"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggleOpen()}
          disabled={loading}
          className="inline-flex min-h-[32px] shrink-0 items-center rounded-lg px-2 text-[11px] font-bold text-store-accent hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "불러오는 중…" : open ? "접기" : "검토하기"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      {open ? (
        <div className="mt-3 border-t border-store-border pt-3">
          {loading && !detail ? (
            <p className="text-xs text-store-muted">검토 내용을 불러오는 중…</p>
          ) : detail ? (
            <ProviderGenerationReviewPanel
              packId={pack.packId}
              pack={detail}
              phase={phase}
              onChanged={handleChanged}
            />
          ) : (
            <p className="text-xs text-store-muted">표시할 검토 내용이 없습니다.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}
