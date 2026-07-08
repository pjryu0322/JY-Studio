"use client";

import { FormEvent, useMemo, useState } from "react";
import { addSourceDocumentApi } from "@/lib/provider-center-api";
import {
  SOURCE_FORMAT_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  formatSourceTypeFieldHints,
  getSourceFormatLabel,
} from "@/lib/source-type-dto";

const inputClass =
  "min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm disabled:opacity-60";

export function ProviderSourceDocumentForm({
  packId,
  disabled,
  onAdded,
}: {
  readonly packId: string;
  readonly disabled: boolean;
  readonly onAdded: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<string>("PRODUCT_MANUAL");
  const [sourceFormat, setSourceFormat] = useState<string>("TEXT");
  const [sourceUrl, setSourceUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [productVersion, setProductVersion] = useState("");
  const [documentVersion, setDocumentVersion] = useState("");
  const [licenseStatus, setLicenseStatus] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = useMemo(
    () => SOURCE_TYPE_OPTIONS.find((o) => o.value === sourceType) ?? null,
    [sourceType],
  );

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disabled) return;
    setSaving(true);
    setError(null);
    try {
      await addSourceDocumentApi(packId, {
        title,
        sourceType,
        sourceFormat,
        sourceUrl: sourceUrl.trim() || undefined,
        fileName: fileName.trim() || undefined,
        mimeType: mimeType.trim() || undefined,
        productVersion: productVersion.trim() || undefined,
        documentVersion: documentVersion.trim() || undefined,
        licenseStatus: licenseStatus.trim() || undefined,
        content: content.trim() || undefined,
      });
      setTitle("");
      setSourceUrl("");
      setFileName("");
      setMimeType("");
      setProductVersion("");
      setDocumentVersion("");
      setLicenseStatus("");
      setContent("");
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "원천 문서를 추가하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-dashed border-store-border bg-slate-50 p-4"
    >
      <h3 className="text-sm font-bold text-slate-900">원천 문서 추가</h3>
      <p className="mt-1 text-xs text-store-muted">
        자료 유형과 형식을 선택하면 등록 시 기본 정합성 검증이 수행됩니다. 원문(content) 또는 URL 중
        하나는 필수입니다.
      </p>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="src-title">
        제목
      </label>
      <input
        id="src-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예: 간편인증 연동 가이드"
        disabled={disabled}
        className={`mt-1 ${inputClass}`}
        required
      />

      <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="src-type">
        자료 유형
      </label>
      <select
        id="src-type"
        value={sourceType}
        onChange={(e) => setSourceType(e.target.value)}
        disabled={disabled}
        className={`mt-1 ${inputClass} bg-white`}
      >
        {SOURCE_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {selectedType ? (
        <div className="mt-1 space-y-1">
          <p className="text-xs leading-relaxed text-store-muted">{selectedType.description}</p>
          {(() => {
            const hints = formatSourceTypeFieldHints(selectedType);
            return (
              <p className="text-xs text-slate-700">
                필수: {hints.requiredLabel}
                {hints.recommendedLabel ? ` · 권장: ${hints.recommendedLabel}` : ""}
              </p>
            );
          })()}
          {selectedType.recommendedFormats.length > 0 ? (
            <p className="text-xs text-store-muted">
              권장 형식:{" "}
              {selectedType.recommendedFormats.map((f) => getSourceFormatLabel(f)).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="src-format">
        자료 형식
      </label>
      <select
        id="src-format"
        value={sourceFormat}
        onChange={(e) => setSourceFormat(e.target.value)}
        disabled={disabled}
        className={`mt-1 ${inputClass} bg-white`}
      >
        {SOURCE_FORMAT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <input
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder="출처 URL (선택)"
        disabled={disabled}
        className={`mt-2 ${inputClass}`}
      />
      <input
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        placeholder="파일명 (선택)"
        disabled={disabled}
        className={`mt-2 ${inputClass}`}
      />
      <input
        value={mimeType}
        onChange={(e) => setMimeType(e.target.value)}
        placeholder="MIME 타입 (선택, 예: text/markdown)"
        disabled={disabled}
        className={`mt-2 ${inputClass}`}
      />
      <input
        value={productVersion}
        onChange={(e) => setProductVersion(e.target.value)}
        placeholder="제품 버전 (샘플 코드 권장)"
        disabled={disabled}
        className={`mt-2 ${inputClass}`}
      />
      <input
        value={documentVersion}
        onChange={(e) => setDocumentVersion(e.target.value)}
        placeholder="문서 버전 (선택)"
        disabled={disabled}
        className={`mt-2 ${inputClass}`}
      />
      <input
        value={licenseStatus}
        onChange={(e) => setLicenseStatus(e.target.value)}
        placeholder="라이선스 상태 (선택)"
        disabled={disabled}
        className={`mt-2 ${inputClass}`}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="문서 원문 또는 요약"
        rows={4}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-store-border px-3 py-2 text-sm disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || saving}
        className="mt-3 min-h-[44px] w-full rounded-xl border border-store-border bg-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? "추가 중…" : "문서 등록"}
      </button>
    </form>
  );
}
