import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { createProviderPackVersionForClient } from "@/lib/provider-pack-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as {
      version?: string;
      overview?: string;
      features?: string[];
      includedKnowledge?: string[];
      supportedEnvironments?: string[];
      targetUsers?: string[];
      useCases?: string[];
      versionSummary?: string;
    };

    const result = await createProviderPackVersionForClient(userId, clientId, packId?.trim() ?? "", {
      version: body.version ?? "",
      overview: body.overview,
      features: body.features,
      includedKnowledge: body.includedKnowledge,
      supportedEnvironments: body.supportedEnvironments,
      targetUsers: body.targetUsers,
      useCases: body.useCases,
      versionSummary: body.versionSummary,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_EDITABLE") {
      return jsonWithClientIdCookie(
        { error: "초안(DRAFT) 상태에서만 버전을 추가할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "VERSION_EXISTS") {
      return jsonWithClientIdCookie({ error: "이미 존재하는 버전입니다." }, clientId, { status: 409 });
    }
    if (result.error === "VALIDATION") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "provider-route", method: "POST", path: "/api/v1/provider/packs/[packId]/versions", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
