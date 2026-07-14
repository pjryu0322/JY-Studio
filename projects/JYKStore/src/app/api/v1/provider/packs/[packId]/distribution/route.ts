import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  getProviderPackDistribution,
  upsertProviderPackDistribution,
} from "@/lib/distribution/distribution-metadata-service";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await getProviderPackDistribution({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
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
      scope: "provider-route",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/distribution",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await upsertProviderPackDistribution({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      body: {
        sourceTitle: typeof body.sourceTitle === "string" ? body.sourceTitle : null,
        sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        sourcePublisherName:
          typeof body.sourcePublisherName === "string" ? body.sourcePublisherName : null,
        sourcePublisherUrl:
          typeof body.sourcePublisherUrl === "string" ? body.sourcePublisherUrl : null,
        sourceDocumentVersion:
          typeof body.sourceDocumentVersion === "string" ? body.sourceDocumentVersion : null,
        sourcePublishedAt:
          typeof body.sourcePublishedAt === "string" ? body.sourcePublishedAt : null,
        sourceRetrievedAt:
          typeof body.sourceRetrievedAt === "string" ? body.sourceRetrievedAt : null,
        licenseName: typeof body.licenseName === "string" ? body.licenseName : "",
        licenseUrl: typeof body.licenseUrl === "string" ? body.licenseUrl : null,
        usageTerms: typeof body.usageTerms === "string" ? body.usageTerms : null,
        readmeText: typeof body.readmeText === "string" ? body.readmeText : null,
        visibility: typeof body.visibility === "string" ? body.visibility : "PRIVATE",
        allowDownload: body.allowDownload !== false,
        contentType: typeof body.contentType === "string" ? body.contentType : null,
      },
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
      scope: "provider-route",
      method: "PUT",
      path: "/api/v1/provider/packs/[packId]/distribution",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
