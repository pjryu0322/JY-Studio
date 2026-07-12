import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  deleteProviderPackPayload,
  getProviderPackPayload,
  uploadProviderPackPayload,
} from "@/lib/distribution/payload-service";
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
    const result = await getProviderPackPayload({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, payload: result.payload }, clientId);
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
      path: "/api/v1/provider/packs/[packId]/payload",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const { getPayloadLimitConfig } = await import("@/lib/distribution/payload-limit-config");
    const maxBytes = getPayloadLimitConfig().maxZipBytes;
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        return jsonWithClientIdCookie(
          {
            error: `요청 크기가 최대(${maxBytes} bytes)를 초과했습니다.`,
            code: "PAYLOAD_REQUEST_TOO_LARGE",
          },
          clientId,
          { status: 413 },
        );
      }
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonWithClientIdCookie(
        { error: "ZIP 파일이 필요합니다.", code: "PAYLOAD_FILE_REQUIRED" },
        clientId,
        { status: 400 },
      );
    }

    if (typeof file.size === "number" && file.size > maxBytes) {
      return jsonWithClientIdCookie(
        {
          error: `ZIP 파일이 최대 크기(${maxBytes} bytes)를 초과했습니다.`,
          code: "PAYLOAD_FILE_TOO_LARGE",
        },
        clientId,
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadProviderPackPayload({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      fileName: file.name,
      mimeType: file.type || null,
      bytes,
      profile: typeof form.get("profile") === "string" ? String(form.get("profile")) : null,
      generatorType:
        typeof form.get("generatorType") === "string" ? String(form.get("generatorType")) : null,
      generatorVersion:
        typeof form.get("generatorVersion") === "string"
          ? String(form.get("generatorVersion"))
          : null,
    });

    return jsonWithClientIdCookie({ clientId, payload: result.payload }, clientId);
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
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/payload",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    await deleteProviderPackPayload({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, deleted: true }, clientId);
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
      method: "DELETE",
      path: "/api/v1/provider/packs/[packId]/payload",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
