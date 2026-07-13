"use client";

import type { PackDistributionMetadataDto } from "@/lib/distribution/distribution-metadata-service";
import type { KnowledgePayloadPublicDto } from "@/lib/distribution/payload-service";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import { isDoclingPayloadReady } from "@/lib/docling-import/docling-import-ui";
import {
  PROVIDER_PACK_GO_TO_DISTRIBUTION_TAB,
  PROVIDER_PACK_GO_TO_PAYLOAD_TAB,
} from "@/lib/role-based-ux-copy";

export type DistributionReadiness = {
  hasBasicInfo: boolean;
  hasPayload: boolean;
  payloadValid: boolean;
  hasChecksum: boolean;
  hasManifest: boolean;
  hasSource: boolean;
  hasLicense: boolean;
  ready: boolean;
  missing: { label: string; tab: "basic" | "payload" | "distribution" }[];
};

export function computeDistributionReadiness(input: {
  hasBasicInfo: boolean;
  payload: KnowledgePayloadPublicDto | null;
  distribution: PackDistributionMetadataDto | null;
  doclingBundle?: DoclingImportBundlePublicDto | null;
}): DistributionReadiness {
  const zipReady =
    Boolean(input.payload) &&
    input.payload?.validationStatus === "VALID" &&
    Boolean(input.payload?.checksumSha256) &&
    Boolean(input.payload?.manifest);
  const doclingReady = isDoclingPayloadReady(input.doclingBundle?.status);
  const hasPayload = Boolean(input.payload) || Boolean(input.doclingBundle);
  const payloadValid = zipReady || doclingReady;
  const hasChecksum =
    Boolean(input.payload?.checksumSha256) ||
    Boolean(input.doclingBundle?.files.some((f) => f.checksumSha256));
  const hasManifest = Boolean(input.payload?.manifest) || doclingReady;
  const hasSource = Boolean(
    input.distribution?.sourceTitle?.trim() || input.distribution?.sourceUrl?.trim(),
  );
  const hasLicense = Boolean(input.distribution?.licenseName?.trim());

  const missing: DistributionReadiness["missing"] = [];
  if (!input.hasBasicInfo) missing.push({ label: "기본정보", tab: "basic" });
  if (!hasPayload) missing.push({ label: "Payload 등록", tab: "payload" });
  else if (!payloadValid) missing.push({ label: "Payload VALID / REVIEW_READY", tab: "payload" });
  if (!hasSource || !hasLicense) missing.push({ label: "유통정보(출처·라이선스)", tab: "distribution" });

  return {
    hasBasicInfo: input.hasBasicInfo,
    hasPayload,
    payloadValid,
    hasChecksum,
    hasManifest,
    hasSource,
    hasLicense,
    ready:
      input.hasBasicInfo &&
      hasPayload &&
      payloadValid &&
      hasChecksum &&
      hasManifest &&
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
  readonly onGoToTab: (tab: "basic" | "payload" | "distribution") => void;
}) {
  return (
    <div className="rounded-xl border border-store-border bg-slate-50 p-3 text-xs text-slate-800">
      <p className="font-semibold text-slate-900">검수 요청 조건</p>
      <ul className="mt-2 space-y-1">
        <li>기본정보: {readiness.hasBasicInfo ? "완료" : "미완료"}</li>
        <li>Payload: {readiness.hasPayload ? "등록됨" : "없음"}</li>
        <li>Checksum: {readiness.hasChecksum ? "있음" : "없음"}</li>
        <li>Validation: {readiness.payloadValid ? "VALID / REVIEW_READY" : "미충족"}</li>
        <li>Manifest: {readiness.hasManifest ? "있음" : "없음"}</li>
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
