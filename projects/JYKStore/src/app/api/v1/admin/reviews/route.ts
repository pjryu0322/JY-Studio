import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { listReviewingPacks } from "@/lib/admin-review-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const items = await listReviewingPacks();
    return jsonWithClientIdCookie({ clientId, items }, clientId);
  } catch (error) {
    logSafeRouteError({ scope: "admin-review", method: "GET", path: "/api/v1/admin/reviews", error });
    return jsonWithClientIdCookie({ error: "?? ??? ??????." }, clientId, { status: 500 });
  }
}
