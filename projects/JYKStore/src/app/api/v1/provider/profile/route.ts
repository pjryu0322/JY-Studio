import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  getProviderProfileByClientId,
  upsertProviderProfileForClient,
} from "@/lib/provider-profile-service";

const PROFILE_ERRORS: Record<string, string> = {
  DISPLAY_NAME_REQUIRED: "표시 이름이 필요합니다.",
  DISPLAY_NAME_LENGTH: "표시 이름은 2~80자로 입력해 주세요.",
  DESCRIPTION_REQUIRED: "소개가 필요합니다.",
  DESCRIPTION_LENGTH: "소개는 10~500자로 입력해 주세요.",
};

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const profile = await getProviderProfileByClientId(clientId);
    return jsonWithClientIdCookie({ clientId, profile }, clientId);
  } catch (error) {
    console.error("GET /api/v1/provider/profile failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const body = (await request.json()) as {
      displayName?: string;
      description?: string;
      websiteUrl?: string;
      contactEmail?: string;
    };

    const result = await upsertProviderProfileForClient(clientId, {
      displayName: body.displayName ?? "",
      description: body.description ?? "",
      websiteUrl: body.websiteUrl,
      contactEmail: body.contactEmail,
    });

    if ("error" in result && result.error) {
      const message = PROFILE_ERRORS[result.error] ?? "입력값을 확인해 주세요.";
      return jsonWithClientIdCookie({ error: message }, clientId, { status: 400 });
    }

    if (!("profile" in result) || !result.profile) {
      return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
    }

    return jsonWithClientIdCookie({ clientId, profile: result.profile }, clientId);
  } catch (error) {
    console.error("POST /api/v1/provider/profile failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
