import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";
import {
  collectProjectPreviewUrlCandidates,
  validatePreviewCaptureTargetUrl,
} from "@/lib/preview/previewCaptureSecurity";
import {
  capturePreviewUrlWithPlaywright,
  pngBufferToDataUrl,
} from "@/lib/preview/previewCaptureServer";
import { putPreviewCaptureSession } from "@/lib/preview/previewCaptureSessionStore";
import {
  DEFAULT_PREVIEW_CAPTURE_VIEWPORT,
  parsePreviewCaptureRequest,
  type PreviewCaptureResponse,
} from "@/lib/preview/previewCaptureTypes";

function readPlatformOrigin(request: NextRequest, bodyOrigin?: string): string {
  const fromBody = String(bodyOrigin ?? "").trim();
  if (fromBody) return fromBody.replace(/\/+$/, "");
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
    const parsed = parsePreviewCaptureRequest(raw);
    if (!parsed) {
      return NextResponse.json(
        { ok: false, errorMessage: "projectId와 previewUrl이 필요합니다." } satisfies PreviewCaptureResponse,
        { status: 400 },
      );
    }

    try {
      await requireProjectPermission(
        parsed.projectId,
        userId,
        "canViewProject",
        "POST /api/preview-capture",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const platformOrigin = readPlatformOrigin(request, parsed.platformOrigin);
    const projectRow = await prisma.project.findUnique({
      where: { id: parsed.projectId },
      select: { requirementsStateJson: true },
    });
    const state = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
    const previewRuntime = parseImplementationPreviewRuntimeV1(state.implementationPreviewRuntimeV1) ?? null;
    const allowedPreviewUrls = collectProjectPreviewUrlCandidates({
      projectId: parsed.projectId,
      previewRuntime,
      platformOrigin,
    });

    const security = validatePreviewCaptureTargetUrl({
      previewUrl: parsed.previewUrl,
      projectId: parsed.projectId,
      platformOrigin,
      allowedPreviewUrls,
    });
    if (!security.ok) {
      return NextResponse.json(
        {
          ok: false,
          errorMessage: security.message,
          errorCode: security.code,
        } satisfies PreviewCaptureResponse,
        { status: security.code === "security" ? 403 : 400 },
      );
    }

    const viewport = parsed.viewport ?? DEFAULT_PREVIEW_CAPTURE_VIEWPORT;
    const shot = await capturePreviewUrlWithPlaywright({
      absolutePreviewUrl: security.absolutePreviewUrl,
      viewport,
      fullPage: parsed.fullPage,
    });
    if (!shot.ok) {
      return NextResponse.json(
        { ok: false, errorMessage: shot.message, errorCode: "capture_failed" } satisfies PreviewCaptureResponse,
        { status: 502 },
      );
    }

    const captureId = crypto.randomUUID();
    const imageDataUrl = pngBufferToDataUrl(shot.pngBuffer);
    putPreviewCaptureSession({
      captureId,
      projectId: parsed.projectId,
      previewUrl: parsed.previewUrl,
      imageDataUrl,
      width: shot.width,
      height: shot.height,
    });

    return NextResponse.json({
      ok: true,
      captureId,
      imageDataUrl,
      width: shot.width,
      height: shot.height,
      previewUrl: parsed.previewUrl,
    } satisfies PreviewCaptureResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errorMessage: message } satisfies PreviewCaptureResponse, { status: 500 });
  }
}
