import { NextRequest } from "next/server";
import { isLoggedInResponse, requireLoggedInRequest } from "@/lib/auth-guard";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  ensureProviderProfileForAccount,
  upsertProviderProfileForUser,
} from "@/lib/provider-profile-service";
import { toProviderProfileDto } from "@/lib/provider-profile-dto";

const PROFILE_ERRORS: Record<string, string> = {
  DISPLAY_NAME_REQUIRED: "표시 이름이 필요합니다.",
  DISPLAY_NAME_LENGTH: "표시 이름은 1~80자로 입력해 주세요.",
  DESCRIPTION_LENGTH: "소개는 500자 이내로 입력해 주세요.",
  WEBSITE_URL_INVALID: "웹사이트 URL 형식이 올바르지 않습니다.",
  CONTACT_EMAIL_INVALID: "연락 이메일 형식이 올바르지 않습니다.",
  NOT_PROVIDER: "제공자 권한이 필요합니다.",
  USER_NOT_FOUND: "계정을 찾을 수 없습니다.",
};

export async function GET(request: NextRequest) {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) return auth;
  const { clientId, userId } = auth;

  try {
    const ensured = await ensureProviderProfileForAccount({ userId, clientId });
    if (!ensured.ok) {
      if (ensured.error === "NOT_PROVIDER") {
        return jsonWithClientIdCookie(
          { error: PROFILE_ERRORS.NOT_PROVIDER, clientId, profile: null },
          clientId,
          { status: 403 },
        );
      }
      return jsonWithClientIdCookie({ error: PROFILE_ERRORS.USER_NOT_FOUND }, clientId, {
        status: 404,
      });
    }

    return jsonWithClientIdCookie(
      { clientId, profile: toProviderProfileDto(ensured.profile) },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({ scope: "provider-route", method: "GET", path: "/api/v1/provider/profile", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

async function upsertHandler(request: NextRequest) {
  const auth = requireLoggedInRequest(request);
  if (!isLoggedInResponse(auth)) return auth;
  const { clientId, userId } = auth;

  try {
    const body = (await request.json()) as {
      displayName?: string;
      description?: string;
      websiteUrl?: string;
      contactEmail?: string;
    };

    const result = await upsertProviderProfileForUser(userId, clientId, {
      displayName: body.displayName ?? "",
      description: body.description ?? "",
      websiteUrl: body.websiteUrl,
      contactEmail: body.contactEmail,
    });

    if ("error" in result && result.error) {
      const message = PROFILE_ERRORS[result.error] ?? "입력값을 확인해 주세요.";
      const status = result.error === "NOT_PROVIDER" ? 403 : 400;
      return jsonWithClientIdCookie({ error: message }, clientId, { status });
    }

    if (!("profile" in result) || !result.profile) {
      return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
    }

    return jsonWithClientIdCookie({ clientId, profile: result.profile }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "provider-route",
      method: request.method,
      path: "/api/v1/provider/profile",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return upsertHandler(request);
}

export async function PATCH(request: NextRequest) {
  return upsertHandler(request);
}
