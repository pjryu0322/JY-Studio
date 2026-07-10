import { NextRequest } from "next/server";
import { parseAccountRole } from "@/lib/account-role";
import { updateRegisteredAccountRole } from "@/lib/admin-accounts-service";
import { rejectUnlessAdmin, requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  const admin = await requireAdminSession(request, clientId);
  if (!admin.ok) {
    return jsonWithClientIdCookie(
      { error: { code: admin.code, message: admin.message } },
      clientId,
      { status: admin.status },
    );
  }

  try {
    const { userId } = await context.params;
    const body = (await request.json()) as { accountRole?: string };
    const accountRole = parseAccountRole(body.accountRole);
    if (!body.accountRole || !["USER", "PROVIDER", "ADMIN"].includes(body.accountRole.trim().toUpperCase())) {
      return jsonWithClientIdCookie(
        { error: "accountRole은 USER, PROVIDER, ADMIN 중 하나여야 합니다." },
        clientId,
        { status: 400 },
      );
    }

    const result = await updateRegisteredAccountRole({
      actorUserId: admin.adminUserId,
      targetUserId: userId,
      accountRole,
    });

    if (!result.ok) {
      const messages = {
        NOT_FOUND: "계정을 찾을 수 없습니다.",
        LAST_ADMIN: "마지막 관리자 역할은 해제할 수 없습니다.",
        SELF_DEMOTE: "자신의 관리자 역할은 해제할 수 없습니다.",
      } as const;
      return jsonWithClientIdCookie(
        { error: messages[result.error] },
        clientId,
        { status: result.error === "NOT_FOUND" ? 404 : 400 },
      );
    }

    return jsonWithClientIdCookie({ clientId, account: result.account }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-accounts",
      method: "PATCH",
      path: "/api/v1/admin/accounts/[userId]",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "계정 역할을 변경하지 못했습니다." },
      clientId,
      { status: 500 },
    );
  }
}
