import { NextRequest } from "next/server";
import { verifyAdminOpsRequest } from "@/lib/admin-auth";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";

/** Lightweight Admin Ops Token check for account UI (no sensitive payload). */
export async function POST(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminAuth = verifyAdminOpsRequest(request);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { ok: false, error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }
  return jsonWithClientIdCookie({ ok: true }, clientId);
}
