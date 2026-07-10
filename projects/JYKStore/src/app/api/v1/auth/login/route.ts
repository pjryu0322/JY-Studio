import { NextRequest } from "next/server";
import { attachAuthSessionCookie } from "@/lib/auth-cookie";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";
import { parseSelectableAccountRole } from "@/lib/account-role";
import {
  loginStoreUser,
  registerStoreUser,
  type StoreAuthMode,
} from "@/lib/store-auth-service";

const LOGIN_ERRORS: Record<string, string> = {
  EMAIL_REQUIRED: "이메일을 입력해 주세요.",
  EMAIL_INVALID: "올바른 이메일 형식이 아닙니다.",
  DISPLAY_NAME_REQUIRED: "표시 이름은 2~80자로 입력해 주세요.",
  USER_NOT_FOUND: "등록된 계정이 없습니다. 먼저 계정을 생성해 주세요.",
  USER_ALREADY_EXISTS: "이미 등록된 이메일입니다. 로그인해 주세요.",
};

export async function POST(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      mode?: StoreAuthMode;
      intendedRole?: string;
      accountRole?: string;
    };
    const mode: StoreAuthMode = body.mode === "register" ? "register" : "login";
    const intendedRole = parseSelectableAccountRole(body.intendedRole ?? body.accountRole);
    const input = {
      email: body.email ?? "",
      displayName: body.displayName ?? "",
      intendedRole: mode === "register" ? intendedRole : undefined,
    };

    const result =
      mode === "register" ? await registerStoreUser(input) : await loginStoreUser(input);

    if ("error" in result && result.error) {
      const message = LOGIN_ERRORS[result.error] ?? "요청을 처리할 수 없습니다.";
      const status = result.error === "USER_NOT_FOUND" || result.error === "USER_ALREADY_EXISTS" ? 409 : 400;
      return jsonWithClientIdCookie({ error: result.error, message }, clientId, { status });
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
        mode,
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
