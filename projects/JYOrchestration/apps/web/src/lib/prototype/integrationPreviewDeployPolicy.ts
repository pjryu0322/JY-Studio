/**
 * 제품화 기본: 프로젝트 UI regex patch 비활성.
 * 레거시 호환: `JY_LEGACY_PREVIEW_SAMPLE_WIRING=1` (또는 `JY_LEGACY_PREVIEW_WIRING_PATCH=1`).
 */
export function isLegacyPreviewSampleWiringEnabled(): boolean {
  const primary = String(process.env.JY_LEGACY_PREVIEW_SAMPLE_WIRING ?? "").trim();
  const legacyAlias = String(process.env.JY_LEGACY_PREVIEW_WIRING_PATCH ?? "").trim();
  const enabled = (v: string) => v === "1" || v.toLowerCase() === "true";
  return enabled(primary) || enabled(legacyAlias);
}

/** @deprecated Use isLegacyPreviewSampleWiringEnabled */
export function isLegacyPreviewWiringPatchEnabled(): boolean {
  return isLegacyPreviewSampleWiringEnabled();
}
