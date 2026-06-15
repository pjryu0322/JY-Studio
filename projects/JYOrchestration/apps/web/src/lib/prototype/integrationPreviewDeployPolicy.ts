/**
 * 제품화 기본: 통합 Preview에 샘플 데이터 wiring·렌더 게이트 필수.
 * 레거시 opt-out: `JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING=1`
 * (구) 레거시 opt-in: `JY_LEGACY_PREVIEW_SAMPLE_WIRING=1` — wiring은 기본 활성이라 별도 의미 없음.
 */
export function isDisableRequiredSampleDataWiringForLegacyOnly(): boolean {
  const v = String(process.env.JY_DISABLE_REQUIRED_PREVIEW_SAMPLE_WIRING ?? "").trim();
  return v === "1" || v.toLowerCase() === "true";
}

export function isRequiredPreviewSampleDataWiringEnabled(): boolean {
  return !isDisableRequiredSampleDataWiringForLegacyOnly();
}

export function isLegacyPreviewSampleWiringEnabled(): boolean {
  const primary = String(process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING ?? "").trim();
  const legacyAlias = String(process.env.JY_LEGACY_PREVIEW_WIRING_PATCH ?? "").trim();
  const enabled = (v: string) => v === "1" || v.toLowerCase() === "true";
  return enabled(primary) || enabled(legacyAlias) || isRequiredPreviewSampleDataWiringEnabled();
}

/** @deprecated Use isLegacyPreviewSampleWiringEnabled */
export function isLegacyPreviewWiringPatchEnabled(): boolean {
  return isLegacyPreviewSampleWiringEnabled();
}
