import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  patchAdminPackDistribution,
  type PatchDistributionMetadataInput,
} from "@/lib/distribution/distribution-metadata-service";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function optionalStringOrNull(
  body: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!hasOwn(body, key)) return undefined;
  const value = body[key];
  if (value == null) return null;
  return typeof value === "string" ? value : null;
}

function optionalBooleanOrNull(
  body: Record<string, unknown>,
  key: string,
): boolean | null | undefined {
  if (!hasOwn(body, key)) return undefined;
  const value = body[key];
  if (value == null) return null;
  return typeof value === "boolean" ? value : Boolean(value);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch: PatchDistributionMetadataInput = {};

    const sourceTitle = optionalStringOrNull(body, "sourceTitle");
    if (sourceTitle !== undefined) patch.sourceTitle = sourceTitle;
    const sourceUrl = optionalStringOrNull(body, "sourceUrl");
    if (sourceUrl !== undefined) patch.sourceUrl = sourceUrl;
    const sourcePublisherName = optionalStringOrNull(body, "sourcePublisherName");
    if (sourcePublisherName !== undefined) patch.sourcePublisherName = sourcePublisherName;
    const sourcePublisherUrl = optionalStringOrNull(body, "sourcePublisherUrl");
    if (sourcePublisherUrl !== undefined) patch.sourcePublisherUrl = sourcePublisherUrl;
    const sourceDocumentVersion = optionalStringOrNull(body, "sourceDocumentVersion");
    if (sourceDocumentVersion !== undefined) patch.sourceDocumentVersion = sourceDocumentVersion;
    const sourcePublishedAt = optionalStringOrNull(body, "sourcePublishedAt");
    if (sourcePublishedAt !== undefined) patch.sourcePublishedAt = sourcePublishedAt;
    const sourceRetrievedAt = optionalStringOrNull(body, "sourceRetrievedAt");
    if (sourceRetrievedAt !== undefined) patch.sourceRetrievedAt = sourceRetrievedAt;
    const licenseName = optionalStringOrNull(body, "licenseName");
    if (licenseName !== undefined) patch.licenseName = licenseName;
    const licenseUrl = optionalStringOrNull(body, "licenseUrl");
    if (licenseUrl !== undefined) patch.licenseUrl = licenseUrl;
    const usageTerms = optionalStringOrNull(body, "usageTerms");
    if (usageTerms !== undefined) patch.usageTerms = usageTerms;
    const readmeText = optionalStringOrNull(body, "readmeText");
    if (readmeText !== undefined) patch.readmeText = readmeText;
    const visibility = optionalStringOrNull(body, "visibility");
    if (visibility !== undefined) patch.visibility = visibility;
    const allowDownload = optionalBooleanOrNull(body, "allowDownload");
    if (allowDownload !== undefined) patch.allowDownload = allowDownload;
    const contentType = optionalStringOrNull(body, "contentType");
    if (contentType !== undefined) patch.contentType = contentType;

    const result = await patchAdminPackDistribution({
      packId: packId?.trim() ?? "",
      actorUserId: adminAuth.adminUserId,
      body: patch,
    });
    return jsonWithClientIdCookie(
      {
        clientId,
        distribution: result.distribution,
        artifactOptions: result.artifactOptions,
      },
      clientId,
    );
  } catch (error) {
    if (isPayloadServiceError(error)) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "admin-route",
      method: "PATCH",
      path: "/api/v1/admin/reviews/[packId]/distribution-metadata",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
