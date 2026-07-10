import { NextRequest } from "next/server";
import { resolveSessionAccountRole } from "@/lib/account-role";
import { getStoreAuthSessionFromRequest } from "@/lib/auth-session";
import { findProviderProfileForUser } from "@/lib/provider-profile-service";
import { toProviderProfileDto } from "@/lib/provider-profile-dto";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { getStoreUserById } from "@/lib/store-auth-service";
import { logSafeRouteError } from "@/lib/safe-logging";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);

  try {
    const session = getStoreAuthSessionFromRequest(request);
    if (!session) {
      return jsonWithClientIdCookie({ loggedIn: false, clientId }, clientId);
    }

    const user = await getStoreUserById(session.userId);
    if (!user) {
      return jsonWithClientIdCookie({ loggedIn: false, clientId }, clientId);
    }

    const profileRow = await findProviderProfileForUser(session.userId, clientId);
    const providerProfile = profileRow ? toProviderProfileDto(profileRow) : null;
    const accountRole = resolveSessionAccountRole({
      storedRole: user.accountRole,
      hasProviderProfile: Boolean(providerProfile),
    });

    return jsonWithClientIdCookie(
      {
        loggedIn: true,
        clientId,
        accountRole,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountRole,
        },
        providerProfile,
      },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({ scope: "auth", method: "GET", path: "/api/v1/auth/session", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
