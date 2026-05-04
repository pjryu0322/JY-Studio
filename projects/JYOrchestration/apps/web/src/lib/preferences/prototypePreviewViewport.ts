/** 프로토타입 Preview iframe 뷰포트(작업모드·모바일 프리셋) — localStorage와 함께 쓰일 타입·상수 */

export type PrototypePreviewWorkMode = "desktop" | "mobile" | "auto";

export type PrototypePreviewMobileDevice = "iphone" | "android";

export const PROTOTYPE_PREVIEW_PRESETS = {
  desktop: { width: 1366, height: 768 },
  iphone: { width: 390, height: 844 },
  android: { width: 360, height: 800 },
} as const;

export function isPrototypePreviewWorkMode(v: string): v is PrototypePreviewWorkMode {
  return v === "desktop" || v === "mobile" || v === "auto";
}

export function isPrototypePreviewMobileDevice(v: string): v is PrototypePreviewMobileDevice {
  return v === "iphone" || v === "android";
}
