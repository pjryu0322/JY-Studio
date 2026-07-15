import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  getServiceValidationStatus,
  runServiceChannelValidation,
} from "@/lib/distribution/service-validation-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;
  try {
    const result = await getServiceValidationStatus({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, ...result }, clientId);
  } catch (error) {
    if (error instanceof PayloadServiceError) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/service-validation",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/service-validation",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;
  try {
    const body = (await request.json()) as { channel?: string; query?: string };
    const channel = (body.channel ?? "").trim().toUpperCase();
    if (channel !== "API" && channel !== "MCP" && channel !== "DOWNLOAD") {
      return jsonWithClientIdCookie(
        { error: "INVALID_CHANNEL", message: "channel은 API | MCP | DOWNLOAD 중 하나여야 합니다." },
        clientId,
        { status: 400 },
      );
    }
    const result = await runServiceChannelValidation({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      channel,
      query: body.query,
    });
    return jsonWithClientIdCookie({ clientId, channel: result }, clientId);
  } catch (error) {
    if (error instanceof PayloadServiceError) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/service-validation",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/service-validation",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
