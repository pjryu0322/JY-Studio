"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProviderDoclingImportTab } from "@/components/provider-distribution/ProviderDoclingImportTab";
import type { KnowledgePayloadPublicDto } from "@/lib/distribution/payload-service";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  createProviderPackVersionApi,
  fetchProviderPackPayloadApi,
} from "@/lib/provider-center-api";

export function ProviderPayloadTab({
  packId,
  editable,
  packStatus,
  latestReviewStatus,
  cachedDoclingBundle,
  onPayloadChanged,
  onDoclingChanged,
  onPackUpdated,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly packStatus?: string;
  readonly latestReviewStatus?: string | null;
  readonly cachedDoclingBundle?: DoclingImportBundlePublicDto | null;
  readonly onPayloadChanged?: (payload: KnowledgePayloadPublicDto | null) => void;
  readonly onDoclingChanged?: (bundle: DoclingImportBundlePublicDto | null) => void;
  readonly onPackUpdated?: (pack: ProviderPackDetailDto) => void;
}) {
  const [payload, setPayload] = useState<KnowledgePayloadPublicDto | null>(null);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [versionOverview, setVersionOverview] = useState("");
  const [versionSummary, setVersionSummary] = useState("");
  const [versionHint, setVersionHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchProviderPackPayloadApi(packId);
      setPayload(data.payload);
      onPayloadChanged?.(data.payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payload를 불러오지 못했습니다.");
    }
  }, [packId, onPayloadChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!editable || creatingVersion) return;
    const version = newVersion.trim();
    if (!version) {
      setError("새 버전 번호가 필요합니다.");
      return;
    }
    setCreatingVersion(true);
    setError(null);
    try {
      const result = await createProviderPackVersionApi(packId, {
        version,
        overview: versionOverview.trim() || undefined,
        versionSummary: versionSummary.trim() || undefined,
      });
      onPackUpdated?.(result.pack);
      setPayload(null);
      onPayloadChanged?.(null);
      onDoclingChanged?.(null);
      setShowVersionForm(false);
      setNewVersion("");
      setVersionOverview("");
      setVersionSummary("");
      setVersionHint("새 버전에 Payload를 등록하세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "버전 생성에 실패했습니다.");
    } finally {
      setCreatingVersion(false);
    }
  };

  const showNewVersionCta =
    editable &&
    packStatus === "DRAFT" &&
    (payload?.canDelete === false || latestReviewStatus === "REJECTED");

  return (
    <div id="pack-payload" className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <ProviderDoclingImportTab
          packId={packId}
          editable={editable}
          cachedBundle={cachedDoclingBundle}
          onDoclingChanged={onDoclingChanged}
        />
      </section>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {versionHint ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {versionHint}
        </div>
      ) : null}

      {showNewVersionCta ? (
        <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
          {!showVersionForm ? (
            <button
              type="button"
              onClick={() => setShowVersionForm(true)}
              className="min-h-[44px] rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950"
            >
              보완용 새 버전 생성
            </button>
          ) : (
            <form onSubmit={(e) => void onCreateVersion(e)} className="space-y-2">
              <p className="text-xs font-semibold text-amber-950">보완용 새 버전 생성</p>
              <input
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="새 버전 번호 (필수)"
                className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
                required
              />
              <input
                value={versionOverview}
                onChange={(e) => setVersionOverview(e.target.value)}
                placeholder="버전 개요 (선택)"
                className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
              />
              <input
                value={versionSummary}
                onChange={(e) => setVersionSummary(e.target.value)}
                placeholder="버전 요약 (선택)"
                className="min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={creatingVersion}
                  className="min-h-[44px] rounded-xl bg-store-accent px-3 text-xs font-bold text-white disabled:opacity-60"
                >
                  {creatingVersion ? "생성 중…" : "버전 생성"}
                </button>
                <button
                  type="button"
                  disabled={creatingVersion}
                  onClick={() => setShowVersionForm(false)}
                  className="min-h-[44px] rounded-xl border border-store-border px-3 text-xs font-semibold text-slate-700"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
