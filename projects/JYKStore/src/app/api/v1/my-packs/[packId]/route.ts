import { NextRequest } from "next/server";
import { ensureClientId, withClientIdCookie } from "@/lib/client-identity";
import { removePackInstallationForClient } from "@/lib/my-packs-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const clientId = ensureClientId(request);
    const { packId } = await context.params;
    const normalizedPackId = packId?.trim();

    if (!normalizedPackId) {
      return withClientIdCookie(request, { error: "packId가 필요합니다." }, { status: 400 });
    }

    await removePackInstallationForClient(clientId, normalizedPackId);

    return withClientIdCookie(request, { ok: true as const });
  } catch (error) {
    console.error("DELETE /api/v1/my-packs/[packId] failed", error);
    return withClientIdCookie(request, { error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
