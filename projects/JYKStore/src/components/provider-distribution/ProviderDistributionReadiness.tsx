"use client";

import type { PackDistributionMetadataDto } from "@/lib/distribution/distribution-metadata-service";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import { isDoclingPayloadReady } from "@/lib/docling-import/docling-import-ui";
import {
  PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB,
  PROVIDER_PACK_GO_TO_PAYLOAD_TAB,
} from "@/lib/role-based-ux-copy";

export type DistributionReadiness = {
  hasBasicInfo: boolean;
  hasLanguage: boolean;
  hasPayload: boolean;
  payloadValid: boolean;
  hasChecksum: boolean;
  hasNormalizedDocument: boolean;
  hasKnowledgePipeline: boolean;
  hasSource: boolean;
  hasLicense: boolean;
  ready: boolean;
  missing: { label: string; tab: "basic" | "payload" | "knowledge" | "distribution" }[];
};

function hasRequiredFilesWithChecksums(
  bundle: DoclingImportBundlePublicDto | null | undefined,
): boolean {
  if (!bundle) return false;
  const roles = ["SOURCE_ORIGINAL", "DOCLING_JSON"] as const;
  return roles.every((role) => {
    const file = bundle.files.find((f) => f.role === role);
    return Boolean(file?.checksumSha256?.trim());
  });
}

export function computeDistributionReadiness(input: {
  hasBasicInfo: boolean;
  hasLanguage: boolean;
  distribution: PackDistributionMetadataDto | null;
  doclingBundle?: DoclingImportBundlePublicDto | null;
  knowledgePassed?: boolean;
}): DistributionReadiness {
  const doclingReady = isDoclingPayloadReady(input.doclingBundle?.status);
  const hasRequiredFiles = hasRequiredFilesWithChecksums(input.doclingBundle);
  const hasNormalizedDocument = Boolean(input.doclingBundle?.normalizedDocument);
  const hasPayload = Boolean(input.doclingBundle);
  const payloadValid = doclingReady && hasRequiredFiles && hasNormalizedDocument;
  const hasChecksum = hasRequiredFiles;
  const hasKnowledgePipeline = Boolean(input.knowledgePassed);
  const hasSource = Boolean(
    input.distribution?.sourceTitle?.trim() || input.distribution?.sourceUrl?.trim(),
  );
  const hasLicense = Boolean(input.distribution?.licenseName?.trim());

  const missing: DistributionReadiness["missing"] = [];
  if (!input.hasBasicInfo) missing.push({ label: "기본정보", tab: "basic" });
  if (!input.hasLanguage) missing.push({ label: "문서 언어를 선택해 주세요.", tab: "basic" });
  if (!hasPayload) missing.push({ label: "등록 자료", tab: "payload" });
  else if (!doclingReady) missing.push({ label: "Docling REVIEW_READY", tab: "payload" });
  else if (!hasRequiredFiles) missing.push({ label: "파일 무결성(원본·JSON checksum)", tab: "payload" });
  else if (!hasNormalizedDocument) missing.push({ label: "문서 정규화", tab: "payload" });
  if (!hasKnowledgePipeline) {
    missing.push({ label: "지식 데이터 생성(검색 검증 통과)", tab: "knowledge" });
  }
  if (!hasSource || !hasLicense) missing.push({ label: "유통정보(출처·라이선스)", tab: "distribution" });

  return {
    hasBasicInfo: input.hasBasicInfo,
    hasLanguage: input.hasLanguage,
    hasPayload,
    payloadValid,
    hasChecksum,
    hasNormalizedDocument,
    hasKnowledgePipeline,
    hasSource,
    hasLicense,
    ready:
      input.hasBasicInfo &&
      input.hasLanguage &&
      hasPayload &&
      payloadValid &&
      hasChecksum &&
      hasNormalizedDocument &&
      hasKnowledgePipeline &&
      hasSource &&
      hasLicense,
    missing,
  };
}

export function ProviderDistributionReadiness({
  readiness,
  onGoToTab,
}: {
  readonly readiness: DistributionReadiness;
  readonly onGoToTab: (tab: "basic" | "payload" | "knowledge" | "distribution") => void;
}) {
  return (
    <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
      <p className="font-semibold text-slate-900">검수 요청 조건</p>
      <ul className="mt-2 space-y-1">
        <li>기본정보: {readiness.hasBasicInfo ? "완료" : "미완료"}</li>
        <li>문서 언어: {readiness.hasLanguage ? "완료" : "미선택"}</li>
        <li>등록 자료: {readiness.hasPayload ? "등록됨" : "없음"}</li>
        <li>파일 무결성: {readiness.hasChecksum ? "있음" : "없음"}</li>
        <li>검증: {readiness.payloadValid ? "REVIEW_READY" : "미충족"}</li>
        <li>문서 정규화: {readiness.hasNormalizedDocument ? "있음" : "없음"}</li>
        <li>지식 데이터 생성: {readiness.hasKnowledgePipeline ? "통과" : "미통과"}</li>
        <li>출처: {readiness.hasSource ? "있음" : "없음"}</li>
        <li>라이선스: {readiness.hasLicense ? "있음" : "없음"}</li>
      </ul>
      {readiness.missing.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {readiness.missing.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onGoToTab(item.tab)}
              className="min-h-[44px] rounded-lg border border-store-border bg-white px-2 text-[11px] font-semibold text-store-accent"
            >
              {item.tab === "payload"
                ? PROVIDER_PACK_GO_TO_PAYLOAD_TAB
                : item.tab === "distribution"
                  ? PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB
                  : "기본정보로 이동"}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 font-semibold text-emerald-800">제출 조건을 모두 충족했습니다.</p>
      )}
    </div>
  );
}
