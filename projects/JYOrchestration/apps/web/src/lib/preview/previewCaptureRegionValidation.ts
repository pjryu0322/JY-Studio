import { getPreviewCaptureSession } from "@/lib/preview/previewCaptureSessionStore";
import type { PreviewCaptureActiveSessionV1 } from "@/lib/preview/previewCaptureActiveSession";
import type { PreviewCaptureRegionRequest } from "@/lib/preview/previewCaptureTypes";
import { PREVIEW_REGION_CAPTURE_MAX_DATA_URL_CHARS } from "@/lib/preview/previewCaptureTypes";

const MAX_REGION_DIMENSION = 8192;
const MIN_REGION_DIMENSION = 1;

export type PreviewRegionValidationResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly status: number }>;

export function normalizePreviewCaptureUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

type SessionIdentity = Readonly<{
  readonly projectId: string;
  readonly previewUrl: string;
}>;

function validateSessionIdentity(
  body: PreviewCaptureRegionRequest,
  session: SessionIdentity,
): PreviewRegionValidationResult {
  if (session.projectId !== body.projectId) {
    return {
      ok: false,
      message: "캡처 세션이 프로젝트와 일치하지 않습니다.",
      status: 403,
    };
  }
  if (normalizePreviewCaptureUrl(session.previewUrl) !== normalizePreviewCaptureUrl(body.previewUrl)) {
    return {
      ok: false,
      message: "캡처 URL이 일치하지 않습니다.",
      status: 400,
    };
  }
  return { ok: true };
}

export function validatePreviewCaptureSessionForRegion(
  body: PreviewCaptureRegionRequest,
  persistedSession?: PreviewCaptureActiveSessionV1 | null,
): PreviewRegionValidationResult {
  const memory = getPreviewCaptureSession(body.captureId);
  if (memory) {
    return validateSessionIdentity(body, memory);
  }
  if (persistedSession) {
    return validateSessionIdentity(body, persistedSession);
  }
  return {
    ok: false,
    message: "캡처 세션이 만료되었습니다. 다시 캡처해 주세요.",
    status: 400,
  };
}

export function validatePreviewRegionImageAndRect(body: PreviewCaptureRegionRequest): PreviewRegionValidationResult {
  const { rect, imageDataUrl, viewport } = body;
  if (!imageDataUrl.startsWith("data:image/png;base64,")) {
    return { ok: false, message: "이미지 형식이 올바르지 않습니다.", status: 400 };
  }
  if (imageDataUrl.length > PREVIEW_REGION_CAPTURE_MAX_DATA_URL_CHARS) {
    return { ok: false, message: "캡처 이미지 크기가 너무 큽니다.", status: 400 };
  }
  if (
    rect.width < MIN_REGION_DIMENSION ||
    rect.height < MIN_REGION_DIMENSION ||
    rect.width > MAX_REGION_DIMENSION ||
    rect.height > MAX_REGION_DIMENSION
  ) {
    return { ok: false, message: "선택 영역 크기가 올바르지 않습니다.", status: 400 };
  }
  if (rect.x < 0 || rect.y < 0) {
    return { ok: false, message: "선택 영역 좌표가 올바르지 않습니다.", status: 400 };
  }
  const maxW = viewport.width * (viewport.deviceScaleFactor ?? 1);
  const maxH = viewport.height * (viewport.deviceScaleFactor ?? 1);
  if (rect.x + rect.width > maxW + 2 || rect.y + rect.height > maxH + 2) {
    return { ok: false, message: "선택 영역이 캡처 화면 범위를 벗어났습니다.", status: 400 };
  }
  return { ok: true };
}
