import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { createSourceDocumentForProviderPack } from "@/lib/provider-pack-service";
import { isSourceFormat, isSourceType } from "@/lib/source-type-dto";
import type { SourceFormat, SourceType } from "@prisma/client";

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
      sourceFormat?: string;
      sourceUrl?: string;
      fileName?: string;
      mimeType?: string;
      content?: string;
      checksum?: string | null;
      productVersion?: string;
      documentVersion?: string;
      licenseStatus?: string;
    };

    const rawSourceType = (body.sourceType ?? "").trim();
    if (!rawSourceType || !isSourceType(rawSourceType)) {
      return jsonWithClientIdCookie(
        { error: "유효하지 않은 자료 유형(sourceType)입니다." },
        clientId,
        { status: 400 },
      );
    }

    const rawSourceFormat = (body.sourceFormat ?? "").trim();
    if (rawSourceFormat && !isSourceFormat(rawSourceFormat)) {
      return jsonWithClientIdCookie(
        { error: "유효하지 않은 자료 형식(sourceFormat)입니다." },
        clientId,
        { status: 400 },
      );
    }

    const content = body.content?.trim() ?? "";
    const sourceUrl = body.sourceUrl?.trim() ?? "";
    if (!content && !sourceUrl) {
      return jsonWithClientIdCookie(
        { error: "원문(content) 또는 출처 URL(sourceUrl) 중 하나는 필요합니다." },
        clientId,
        { status: 400 },
      );
    }

    const result = await createSourceDocumentForProviderPack(clientId, packId?.trim() ?? "", {
      title: body.title ?? "",
      sourceType: rawSourceType as SourceType,
      sourceFormat: (rawSourceFormat || undefined) as SourceFormat | undefined,
      sourceUrl: body.sourceUrl,
      fileName: body.fileName,
      mimeType: body.mimeType,
      content: body.content,
      checksum: body.checksum,
      productVersion: body.productVersion,
      documentVersion: body.documentVersion,
      licenseStatus: body.licenseStatus,
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
    logSafeRouteError({ scope: "provider-route", method: "POST", path: "/api/v1/provider/packs/[packId]/source-documents", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
