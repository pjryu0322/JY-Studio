/**
 * 제품화 기본: 프로젝트 UI regex patch 비활성.
 * 레거시 호환 시 `JY_LEGACY_PREVIEW_WIRING_PATCH=1`.
 */
export function isLegacyPreviewWiringPatchEnabled(): boolean {
  const flag = String(process.env.JY_LEGACY_PREVIEW_WIRING_PATCH ?? "").trim();
  return flag === "1" || flag.toLowerCase() === "true";
}
