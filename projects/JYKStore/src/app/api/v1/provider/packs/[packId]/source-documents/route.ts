import { NextRequest } from "next/server";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { createSourceDocumentForProviderPack } from "@/lib/provider-pack-service";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as {
      title?: string;
      sourceType?: string;
      sourceUrl?: string;
      content?: string;
      checksum?: string | null;
    };

    const result = await createSourceDocumentForProviderPack(clientId, packId?.trim() ?? "", {
      title: body.title ?? "",
      sourceType: body.sourceType ?? "",
      sourceUrl: body.sourceUrl,
      content: body.content,
      checksum: body.checksum,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "지식팩을 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "NOT_EDITABLE") {
      return jsonWithClientIdCookie(
        { error: "초안(DRAFT) 상태에서만 원천 문서를 추가할 수 있습니다." },
        clientId,
        { status: 409 },
      );
    }
    if (result.error === "VALIDATION") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }
    if (result.error === "VERSION_REQUIRED") {
      return jsonWithClientIdCookie({ error: "버전이 없습니다." }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie({ clientId, pack: result.pack }, clientId);
  } catch (error) {
    console.error("POST /api/v1/provider/packs/[packId]/source-documents failed", error);
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
