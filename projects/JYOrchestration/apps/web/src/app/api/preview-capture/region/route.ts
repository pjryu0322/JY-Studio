import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { persistPreviewRegionCapture } from "@/lib/preview/previewCaptureRegionPersist";
import {
  parsePreviewCaptureRegionRequest,
  type PreviewCaptureRegionResponse,
} from "@/lib/preview/previewCaptureTypes";

function readPlatformOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");
  return request.nextUrl.origin.replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const raw = await request.json().catch(() => null);
    const body = parsePreviewCaptureRegionRequest(raw);
    if (!body) {
      return NextResponse.json(
        { ok: false, errorMessage: "요청 형식이 올바르지 않습니다." } satisfies PreviewCaptureRegionResponse,
        { status: 400 },
      );
    }

    try {
      await requireProjectPermission(
        body.projectId,
        userId,
        "canEditProject",
        "POST /api/preview-capture/region",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const result = await persistPreviewRegionCapture({
      body,
      platformOrigin: readPlatformOrigin(request),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, errorMessage: result.message } satisfies PreviewCaptureRegionResponse,
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      regionCaptureId: result.regionCaptureId,
      imageUrl: result.imageDataUrl,
    } satisfies PreviewCaptureRegionResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errorMessage: message } satisfies PreviewCaptureRegionResponse, {
      status: 500,
    });
  }
}
