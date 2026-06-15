import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  collectProjectPreviewUrlCandidates,
  validatePreviewCaptureTargetUrl,
} from "@/lib/preview/previewCaptureSecurity";
import {
  validatePreviewCaptureSessionForRegion,
  validatePreviewRegionImageAndRect,
} from "@/lib/preview/previewCaptureRegionValidation";
import {
  IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY,
  type ImplementationPreviewRegionCaptureV1,
  type PreviewCaptureRegionRequest,
} from "@/lib/preview/previewCaptureTypes";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

export async function persistPreviewRegionCapture(input: {
  readonly body: PreviewCaptureRegionRequest;
  readonly platformOrigin: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly regionCaptureId: string; readonly imageDataUrl: string }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly status: number }>
> {
  const sessionCheck = validatePreviewCaptureSessionForRegion(input.body);
  if (!sessionCheck.ok) {
    return { ok: false, message: sessionCheck.message, status: sessionCheck.status };
  }
  const imageCheck = validatePreviewRegionImageAndRect(input.body);
  if (!imageCheck.ok) {
    return { ok: false, message: imageCheck.message, status: imageCheck.status };
  }

  const row = await prisma.project.findUnique({
    where: { id: input.body.projectId },
    select: { requirementsStateJson: true },
  });
  if (!row) {
    return { ok: false, message: "프로젝트를 찾을 수 없습니다.", status: 404 };
  }

  const prior = parseRequirementsStateJson(row.requirementsStateJson) ?? {};
  const previewRuntime = parseImplementationPreviewRuntimeV1(prior.implementationPreviewRuntimeV1) ?? null;
  const allowed = collectProjectPreviewUrlCandidates({
    projectId: input.body.projectId,
    previewRuntime,
    platformOrigin: input.platformOrigin,
  });
  const security = validatePreviewCaptureTargetUrl({
    previewUrl: input.body.previewUrl,
    projectId: input.body.projectId,
    platformOrigin: input.platformOrigin,
    allowedPreviewUrls: allowed,
  });
  if (!security.ok) {
    return { ok: false, message: security.message, status: security.code === "security" ? 403 : 400 };
  }

  const regionCaptureId = crypto.randomUUID();
  const captureRecord: ImplementationPreviewRegionCaptureV1 = {
    id: regionCaptureId,
    projectId: input.body.projectId,
    stage: "implementation",
    previewUrl: input.body.previewUrl,
    source: "server_preview_capture",
    captureId: input.body.captureId,
    imageDataUrl: input.body.imageDataUrl,
    ...(input.body.memo ? { memo: input.body.memo } : {}),
    ...(input.body.meta ? { meta: input.body.meta } : {}),
    viewport: input.body.viewport,
    rect: input.body.rect,
    createdAt: new Date().toISOString(),
  };

  const priorCaptures = Array.isArray(
    (prior as Record<string, unknown>)[IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY],
  )
    ? ((prior as Record<string, unknown>)[IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY] as ImplementationPreviewRegionCaptureV1[])
    : [];
  const nextCaptures = [...priorCaptures, captureRecord].slice(-80);

  const merged = mergeRequirementsStateJson(prior, {
    [IMPLEMENTATION_PREVIEW_REGION_CAPTURES_KEY]: nextCaptures,
    lastSavedAt: new Date().toISOString(),
  });

  await prisma.project.update({
    where: { id: input.body.projectId },
    data: { requirementsStateJson: merged as object },
  });

  return {
    ok: true,
    regionCaptureId,
    imageDataUrl: input.body.imageDataUrl,
  };
}
