import { NextRequest, NextResponse } from "next/server";
import { attachAuthSessionCookie } from "@/lib/auth-cookie";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";
import { canUseTestAccountSwitcher } from "@/lib/test-account-switcher";
import { findTestAccountById } from "@/lib/test-account-service";

export const dynamic = "force-dynamic";

const MAX_USER_ID_LENGTH = 128;

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function notFound(clientId: string) {
  return withNoStore(jsonWithClientIdCookie({ error: "NOT_FOUND" }, clientId, { status: 404 }));
}

export async function POST(request: NextRequest) {
  const clientId = ensureClientId(request);

  if (!canUseTestAccountSwitcher(request)) {
    return notFound(clientId);
  }

  try {
    const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!userId || userId.length > MAX_USER_ID_LENGTH) {
      return withNoStore(
        jsonWithClientIdCookie(
          { error: "VALIDATION", message: "userId가 필요합니다." },
          clientId,
          { status: 400 },
        ),
      );
    }

    const user = await findTestAccountById(userId);
    if (!user) {
      return notFound(clientId);
    }

    const response = withNoStore(
      jsonWithClientIdCookie(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            accountRole: user.accountRole,
          },
          accountRole: user.accountRole,
          testLogin: true as const,
        },
        clientId,
      ),
    );

    return attachAuthSessionCookie(response, {
      userId: user.id,
      email: user.email,
      name: user.name?.trim() || user.email,
    });
  } catch (error) {
    logSafeRouteError({
      scope: "dev-test-accounts",
      method: "POST",
      path: "/api/v1/dev/test-accounts/login",
      error,
    });
    return withNoStore(
      jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 }),
    );
  }
}
