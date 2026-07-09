import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOpsRequest } from "@/lib/admin-auth";
import { jsonWithClientIdCookie } from "@/lib/client-identity";

/**
 * Returns a denial response when Admin Ops Token check fails; null when allowed.
 */
export function rejectUnlessAdminOps(
  request: NextRequest,
  clientId: string,
): NextResponse | null {
  const adminAuth = verifyAdminOpsRequest(request);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  return null;
}
