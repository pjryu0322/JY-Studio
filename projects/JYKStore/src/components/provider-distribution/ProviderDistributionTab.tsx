"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { PackDistributionMetadataDto } from "@/lib/distribution/distribution-metadata-service";
import {
  fetchProviderPackDistributionApi,
  upsertProviderPackDistributionApi,
} from "@/lib/provider-center-api";

export function ProviderDistributionTab({
  packId,
  editable,
  onDistributionChanged,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onDistributionChanged?: (row: PackDistributionMetadataDto | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [licenseName, setLicenseName] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [usageTerms, setUsageTerms] = useState("");
  const [readmeText, setReadmeText] = useState("");
  const [visibility, setVisibility] = useState("PRIVATE");
  const [allowDownload, setAllowDownload] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviderPackDistributionApi(packId);
      const row = data.distribution;
      onDistributionChanged?.(row);
      if (row) {
        setSourceTitle(row.sourceTitle ?? "");
        setSourceUrl(row.sourceUrl ?? "");
        setLicenseName(row.licenseName);
        setLicenseUrl(row.licenseUrl ?? "");
        setUsageTerms(row.usageTerms ?? "");
        setReadmeText(row.readmeText ?? "");
        setVisibility(row.visibility);
        setAllowDownload(row.allowDownload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "유통정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, onDistributionChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editable || saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = await upsertProviderPackDistributionApi(packId, {
        sourceTitle,
        sourceUrl,
        licenseName,
        licenseUrl,
        usageTerms,
        readmeText,
        visibility,
        allowDownload,
      });
      onDistributionChanged?.(data.distribution);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">유통정보 불러오는 중…</p>;
  }

  return (
    <section id="pack-distribution" className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <div>
        <h2 className="text-sm font-bold text-slate-900">유통정보</h2>
        <p className="mt-1 text-xs text-store-muted">
          출처·라이선스·이용조건을 입력합니다. 검수 요청 전에 필수입니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <form onSubmit={(e) => void onSave(e)} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="dist-source-title">
            출처명
          </label>
          <input
            id="dist-source-title"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            disabled={!editable}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="dist-source-url">
            출처 URL
          </label>
          <input
            id="dist-source-url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            disabled={!editable}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
            placeholder="https://"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="dist-license">
            라이선스명 *
          </label>
          <input
            id="dist-license"
            value={licenseName}
            onChange={(e) => setLicenseName(e.target.value)}
            disabled={!editable}
            required
            className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="dist-license-url">
            라이선스 URL
          </label>
          <input
            id="dist-license-url"
            value={licenseUrl}
            onChange={(e) => setLicenseUrl(e.target.value)}
            disabled={!editable}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="dist-terms">
            이용조건
          </label>
          <textarea
            id="dist-terms"
            value={usageTerms}
            onChange={(e) => setUsageTerms(e.target.value)}
            disabled={!editable}
            rows={3}
            className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="dist-readme">
            README / 사용방법
          </label>
          <textarea
            id="dist-readme"
            value={readmeText}
            onChange={(e) => setReadmeText(e.target.value)}
            disabled={!editable}
            rows={4}
            className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700" htmlFor="dist-visibility">
            공개범위
          </label>
          <select
            id="dist-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            disabled={!editable}
            className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
          >
            <option value="PRIVATE">PRIVATE — 카탈로그·다운로드 비공개</option>
            <option value="UNLISTED">UNLISTED — 목록 비노출, 직접 링크로 접근</option>
            <option value="PUBLIC">PUBLIC — 카탈로그 노출</option>
          </select>
          <p className="mt-1 text-xs text-store-muted">
            승인 후에도 Provider가 선택한 공개범위가 유지됩니다.
          </p>
        </div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={allowDownload}
            onChange={(e) => setAllowDownload(e.target.checked)}
            disabled={!editable}
          />
          승인 후 Payload 다운로드 허용
        </label>

        {editable ? (
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] w-full rounded-xl bg-store-accent text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "저장 중…" : "유통정보 저장"}
          </button>
        ) : null}
      </form>
    </section>
  );
}
