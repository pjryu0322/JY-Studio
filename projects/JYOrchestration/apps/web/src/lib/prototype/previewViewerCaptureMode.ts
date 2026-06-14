import { isHttpUrl } from "@/lib/prototype/previewUrlClassification";

/** iframe DOM 직접 캡처 대신 getDisplayMedia가 필요한 Preview target */
export function isPreviewViewerExternalCaptureTarget(previewUrl: string): boolean {
  const trimmed = previewUrl.trim();
  if (!trimmed) return false;
  if (!isHttpUrl(trimmed)) return false;
  if (typeof window === "undefined") return true;
  try {
    return new URL(trimmed).origin !== window.location.origin;
  } catch {
    return true;
  }
}

export const EXTERNAL_PREVIEW_CAPTURE_GUIDANCE =
  "외부 Preview URL입니다. 브라우저 화면 캡처 방식으로 진행합니다. 권한 창에서 현재 Preview 탭 또는 Preview 창을 선택해 주세요." as const;
