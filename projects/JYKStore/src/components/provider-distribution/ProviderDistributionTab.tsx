"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  DistributionArtifactOptionsDto,
  PackDistributionMetadataDto,
} from "@/lib/distribution/distribution-metadata-service";
import {
  fetchProviderPackDistributionApi,
  upsertProviderPackDistributionApi,
} from "@/lib/provider-center-api";

const RIGHTS_OPTIONS = [
  { value: "PUBLIC_LICENSE", label: "공개 라이선스가 적용된 자료" },
  { value: "RIGHTS_HOLDER", label: "제공자가 저작권 또는 유통 권한을 보유" },
  { value: "AUTHORIZED_BY_RIGHTS_HOLDER", label: "원저작권자로부터 유통 허가를 받음" },
  { value: "OTHER", label: "기타" },
] as const;

export function ProviderDistributionTab({
  packId,
  editable,
  onDistributionChanged,
  onGoToServiceValidation,
}: {
  readonly packId: string;
  readonly editable: boolean;
  readonly onDistributionChanged?: (row: PackDistributionMetadataDto | null) => void;
  readonly onGoToServiceValidation?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePublisherName, setSourcePublisherName] = useState("");
  const [sourcePublisherUrl, setSourcePublisherUrl] = useState("");
  const [sourceDocumentVersion, setSourceDocumentVersion] = useState("");
  const [sourcePublishedAt, setSourcePublishedAt] = useState("");
  const [sourceRetrievedAt, setSourceRetrievedAt] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [usageTerms, setUsageTerms] = useState("");
  const [rightsBasis, setRightsBasis] = useState("");
  const [rightsBasisDetail, setRightsBasisDetail] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [visibility, setVisibility] = useState("PRIVATE");
  const [allowApi, setAllowApi] = useState(true);
  const [allowMcp, setAllowMcp] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [serviceEndsAt, setServiceEndsAt] = useState("");
  const [artifactOptions, setArtifactOptions] = useState<DistributionArtifactOptionsDto>({
    zipReady: false,
    externalImportReady: false,
    selectedPrimaryArtifactType: null,
    multipleReady: false,
  });

  const applyRow = useCallback(
    (row: PackDistributionMetadataDto | null, options?: DistributionArtifactOptionsDto) => {
      onDistributionChanged?.(row);
      if (options) setArtifactOptions(options);
      if (!row) return;
      setSourceTitle(row.sourceTitle ?? "");
      setSourceUrl(row.sourceUrl ?? "");
      setSourcePublisherName(row.sourcePublisherName ?? "");
      setSourcePublisherUrl(row.sourcePublisherUrl ?? "");
      setSourceDocumentVersion(row.sourceDocumentVersion ?? "");
      setSourcePublishedAt(row.sourcePublishedAt?.slice(0, 10) ?? "");
      setSourceRetrievedAt(row.sourceRetrievedAt);
      setLicenseName(
        row.rightsBasis === "PUBLIC_LICENSE" ? row.licenseName : row.licenseName ?? "",
      );
      setLicenseUrl(row.licenseUrl ?? "");
      setUsageTerms(row.usageTerms ?? "");
      setRightsBasis(row.rightsBasis ?? "");
      setRightsBasisDetail(row.rightsBasisDetail ?? "");
      setRightsConfirmed(row.rightsConfirmed);
      setVisibility(row.visibility);
      setAllowApi(row.allowApi);
      setAllowMcp(row.allowMcp);
      setAllowDownload(row.allowDownload);
      setServiceEndsAt(row.serviceEndsAt?.slice(0, 10) ?? "");
    },
    [onDistributionChanged],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviderPackDistributionApi(packId);
      applyRow(data.distribution, data.artifactOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "유통정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [packId, applyRow]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editable || saving) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const data = await upsertProviderPackDistributionApi(packId, {
        sourceTitle,
        sourceUrl,
        sourcePublisherName,
        sourcePublisherUrl,
        sourceDocumentVersion,
        sourcePublishedAt: sourcePublishedAt || null,
        licenseName: rightsBasis === "PUBLIC_LICENSE" ? licenseName : undefined,
        licenseUrl: rightsBasis === "PUBLIC_LICENSE" ? licenseUrl : undefined,
        usageTerms,
        visibility,
        allowApi,
        allowMcp,
        allowDownload,
        rightsBasis,
        rightsBasisDetail:
          rightsBasis && rightsBasis !== "PUBLIC_LICENSE" ? rightsBasisDetail : null,
        rightsConfirmed,
        serviceEndsAt: serviceEndsAt || null,
      });
      applyRow(data.distribution, data.artifactOptions);
      setSavedMessage(
        "유통정보가 저장되었습니다. 선택한 제공 방식을 서비스 검증에서 확인해 주세요.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-store-muted">유통정보 불러오는 중…</p>;
  }

  const showLicenseFields = rightsBasis === "PUBLIC_LICENSE";
  const showRightsDetail = Boolean(rightsBasis && rightsBasis !== "PUBLIC_LICENSE");

  return (
    <section
      id="pack-distribution"
      className="space-y-4 rounded-2xl border border-store-border bg-white p-4 shadow-card"
    >
      <div>
        <h2 className="text-sm font-bold text-slate-900">유통정보</h2>
        <p className="mt-1 text-xs text-store-muted">
          출처·제공 방식·유통 권한·공개 정책을 입력합니다. 저장 후 서비스 검증이 필요합니다.
        </p>
        {artifactOptions.externalImportReady ? (
          <p className="mt-1 text-xs text-store-muted">
            공개 다운로드는 Docling 원본문서를 제공합니다.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {savedMessage ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>{savedMessage}</p>
          <button
            type="button"
            onClick={() => onGoToServiceValidation?.()}
            className="min-h-[44px] rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white"
          >
            서비스 검증으로 이동
          </button>
        </div>
      ) : null}

      <form onSubmit={(e) => void onSave(e)} className="space-y-4">
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-slate-900">원천 문서 정보</legend>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-source-title">
              원천 문서 제목
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
              원문 게시 URL
            </label>
            <input
              id="dist-source-url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={!editable}
              className="mt-2 min-h-[44px] w-full break-all rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
              placeholder="https://"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-publisher-name">
              발행기관명
            </label>
            <input
              id="dist-publisher-name"
              value={sourcePublisherName}
              onChange={(e) => setSourcePublisherName(e.target.value)}
              disabled={!editable}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-publisher-url">
              발행기관 URL
            </label>
            <input
              id="dist-publisher-url"
              value={sourcePublisherUrl}
              onChange={(e) => setSourcePublisherUrl(e.target.value)}
              disabled={!editable}
              className="mt-2 min-h-[44px] w-full break-all rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-doc-version">
              문서 버전
            </label>
            <input
              id="dist-doc-version"
              value={sourceDocumentVersion}
              onChange={(e) => setSourceDocumentVersion(e.target.value)}
              disabled={!editable}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-published-at">
              원문 게시일
            </label>
            <input
              id="dist-published-at"
              type="date"
              value={sourcePublishedAt}
              onChange={(e) => setSourcePublishedAt(e.target.value)}
              disabled={!editable}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
            />
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-store-muted">
            <p className="font-semibold text-slate-700">수집일</p>
            <p className="mt-1">
              {sourceRetrievedAt
                ? `${sourceRetrievedAt.slice(0, 10)} · 자료 등록 시 자동 기록`
                : "저장 시 자료 등록 기준으로 자동 기록됩니다."}
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-slate-900">제공 방식 *</legend>
          <p className="text-xs text-store-muted">최소 한 개 이상 선택해야 합니다.</p>
          <label className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={allowApi}
              onChange={(e) => setAllowApi(e.target.checked)}
              disabled={!editable}
            />
            <span>
              <span className="font-semibold">Retrieval API 제공</span>
              <span className="mt-0.5 block text-xs text-store-muted">
                외부 시스템이 질문을 보내 관련 지식과 출처를 조회합니다.
              </span>
            </span>
          </label>
          <label className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={allowMcp}
              onChange={(e) => setAllowMcp(e.target.checked)}
              disabled={!editable}
            />
            <span>
              <span className="font-semibold">MCP 제공</span>
              <span className="mt-0.5 block text-xs text-store-muted">
                GPT, Cursor 등 MCP 지원 AI 도구가 지식팩을 검색하고 활용합니다.
              </span>
            </span>
          </label>
          <label className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
              disabled={!editable}
            />
            <span>
              <span className="font-semibold">원본문서 다운로드 제공</span>
              <span className="mt-0.5 block text-xs text-store-muted">
                승인된 원본 문서를 사용자가 직접 내려받을 수 있습니다.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-slate-900">권리 및 유통 권한</legend>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-rights-basis">
              유통 권한 근거 *
            </label>
            <select
              id="dist-rights-basis"
              value={rightsBasis}
              onChange={(e) => setRightsBasis(e.target.value)}
              disabled={!editable}
              required
              className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
            >
              <option value="">선택하세요</option>
              {RIGHTS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {showLicenseFields ? (
            <>
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
                  className="mt-2 min-h-[44px] w-full break-all rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
                />
              </div>
            </>
          ) : null}
          {showRightsDetail ? (
            <div>
              <label className="text-xs font-semibold text-slate-700" htmlFor="dist-rights-detail">
                권한 근거 설명 *
              </label>
              <textarea
                id="dist-rights-detail"
                value={rightsBasisDetail}
                onChange={(e) => setRightsBasisDetail(e.target.value)}
                disabled={!editable}
                required
                rows={3}
                className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
          ) : null}
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-terms">
              추가 이용조건
            </label>
            <textarea
              id="dist-terms"
              value={usageTerms}
              onChange={(e) => setUsageTerms(e.target.value)}
              disabled={!editable}
              rows={3}
              placeholder="출처 표시 필요, 재배포 금지 등"
              className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>
          <label className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              disabled={!editable}
              required
            />
            <span>선택한 제공 방식으로 이 지식팩을 유통할 권한이 있음을 확인합니다. *</span>
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-slate-900">공개 정책</legend>
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
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700" htmlFor="dist-service-ends">
              서비스 종료일
            </label>
            <input
              id="dist-service-ends"
              type="date"
              value={serviceEndsAt}
              onChange={(e) => setServiceEndsAt(e.target.value)}
              disabled={!editable}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:bg-slate-50"
            />
            <p className="mt-1 text-xs text-store-muted">비어 있으면 종료일 없음. 경과 시 모든 제공 방식이 차단됩니다.</p>
          </div>
        </fieldset>

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
