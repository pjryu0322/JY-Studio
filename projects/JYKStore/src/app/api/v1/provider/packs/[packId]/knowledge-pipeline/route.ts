import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  getDoclingKnowledgePipelineStatus,
  startDoclingKnowledgePipeline,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await getDoclingKnowledgePipelineStatus({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    if ("error" in result) {
      const status = result.error === "NOT_FOUND" ? 404 : 403;
      return jsonWithClientIdCookie({ error: result.error }, clientId, { status });
    }
    return jsonWithClientIdCookie({ clientId, ...result }, clientId);
  } catch (error) {
    logSafeRouteError("provider/knowledge-pipeline GET", error, { packId, clientId });
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

  let forceRestart = false;
  try {
    const body = (await request.json()) as { forceRestart?: boolean };
    forceRestart = Boolean(body?.forceRestart);
  } catch {
    forceRestart = false;
  }

  try {
    const result = await startDoclingKnowledgePipeline({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      forceRestart,
    });
    if ("error" in result) {
      const status =
        result.error === "NOT_FOUND"
          ? 404
          : result.error === "PROFILE_REQUIRED"
            ? 403
            : 400;
      return jsonWithClientIdCookie(
        { error: result.error, message: result.message },
        clientId,
        { status },
      );
    }
    return jsonWithClientIdCookie({ clientId, ...result }, clientId);
  } catch (error) {
    logSafeRouteError("provider/knowledge-pipeline POST", error, { packId, clientId });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
