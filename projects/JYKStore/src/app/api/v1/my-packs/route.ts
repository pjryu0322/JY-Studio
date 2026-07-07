import { NextRequest } from "next/server";
import { ensureClientId, withClientIdCookie } from "@/lib/client-identity";
import { addPackInstallationForClient, listActiveMyPacksForClient } from "@/lib/my-packs-service";

export async function GET(request: NextRequest) {
  try {
    const clientId = ensureClientId(request);
    const items = await listActiveMyPacksForClient(clientId);

    return withClientIdCookie(request, { clientId, items });
  } catch (error) {
    console.error("GET /api/v1/my-packs failed", error);
    return withClientIdCookie(request, { error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientId = ensureClientId(request);
    const body = (await request.json()) as { packId?: string };
    const packId = body.packId?.trim();

    if (!packId) {
      return withClientIdCookie(request, { error: "packId가 필요합니다." }, { status: 400 });
    }

    const result = await addPackInstallationForClient(clientId, packId);

    if (result.error === "NOT_FOUND") {
      return withClientIdCookie(request, { error: "지식팩을 찾을 수 없습니다." }, { status: 404 });
    }

    if (result.error === "NOT_PUBLISHED") {
      return withClientIdCookie(
        request,
        { error: "공개된 지식팩만 내 지식팩에 추가할 수 있습니다." },
        { status: 409 },
      );
    }

    return withClientIdCookie(request, {
      clientId,
      item: result.pack,
    });
  } catch (error) {
    console.error("POST /api/v1/my-packs failed", error);
    return withClientIdCookie(request, { error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
