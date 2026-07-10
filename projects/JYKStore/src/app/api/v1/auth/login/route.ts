import { NextRequest } from "next/server";
import { attachAuthSessionCookie } from "@/lib/auth-cookie";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";
import { loginOrCreateStoreUser } from "@/lib/store-auth-service";

const LOGIN_ERRORS: Record<string, string> = {
  EMAIL_REQUIRED: "이메일을 입력해 주세요.",
  EMAIL_INVALID: "올바른 이메일 형식이 아닙니다.",
  DISPLAY_NAME_REQUIRED: "표시 이름은 2~80자로 입력해 주세요.",
};

export async function POST(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const body = (await request.json()) as { email?: string; displayName?: string };
    const result = await loginOrCreateStoreUser({
      email: body.email ?? "",
      displayName: body.displayName ?? "",
    });

    if ("error" in result && result.error) {
      const message = LOGIN_ERRORS[result.error] ?? "로그인할 수 없습니다.";
      return jsonWithClientIdCookie({ error: result.error, message }, clientId, { status: 400 });
    }

    const user = result.user!;
    const response = jsonWithClientIdCookie(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountRole: user.accountRole,
        },
        accountRole: user.accountRole,
      },
      clientId,
    );
    return attachAuthSessionCookie(response, {
      userId: user.id,
      email: user.email,
      name: user.name ?? body.displayName?.trim() ?? "",
    });
  } catch (error) {
    logSafeRouteError({ scope: "auth", method: "POST", path: "/api/v1/auth/login", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
