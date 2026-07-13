import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { getPayloadLimitConfig } from "@/lib/distribution/payload-limit-config";
import { isDoclingImportError } from "@/lib/docling-import/docling-import-errors";
import {
  deleteActiveDoclingImport,
  getActiveDoclingImport,
  uploadDoclingImportBundle,
} from "@/lib/docling-import/docling-import-service";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const result = await getActiveDoclingImport({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie(
      { clientId, bundle: result.bundle, stagingBundle: result.stagingBundle },
      clientId,
    );
  } catch (error) {
    if (isDoclingImportError(error)) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/docling-import",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const limits = getPayloadLimitConfig();
    const maxBytes = Math.min(limits.maxSingleEntryBytes, limits.maxZipBytes) * 3;
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        return jsonWithClientIdCookie(
          {
            error: `요청 크기가 최대(${maxBytes} bytes)를 초과했습니다.`,
            code: "DOCLING_REQUEST_TOO_LARGE",
          },
          clientId,
          { status: 413 },
        );
      }
    }

    const form = await request.formData();
    const sourceFile = form.get("sourceFile");
    const jsonFile = form.get("doclingJsonFile");
    const markdownFile = form.get("doclingMarkdownFile");
    if (!(sourceFile instanceof File) || !(jsonFile instanceof File) || !(markdownFile instanceof File)) {
      return jsonWithClientIdCookie(
        {
          error: "sourceFile, doclingJsonFile, doclingMarkdownFile이 필요합니다.",
          code: "DOCLING_FILE_REQUIRED",
        },
        clientId,
        { status: 400 },
      );
    }

    const adapterVersionRaw = form.get("adapterVersion");
    void adapterVersionRaw; // ignored: server locks adapter version

    const result = await uploadDoclingImportBundle({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      source: {
        fileName: sourceFile.name,
        mimeType: sourceFile.type || null,
        bytes: new Uint8Array(await sourceFile.arrayBuffer()),
      },
      json: {
        fileName: jsonFile.name,
        mimeType: jsonFile.type || null,
        bytes: new Uint8Array(await jsonFile.arrayBuffer()),
      },
      markdown: {
        fileName: markdownFile.name,
        mimeType: markdownFile.type || null,
        bytes: new Uint8Array(await markdownFile.arrayBuffer()),
      },
    });

    return jsonWithClientIdCookie({ clientId, bundle: result.bundle }, clientId);
  } catch (error) {
    if (isDoclingImportError(error)) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/docling-import",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    await deleteActiveDoclingImport({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, deleted: true }, clientId);
  } catch (error) {
    if (isDoclingImportError(error)) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider-route",
      method: "DELETE",
      path: "/api/v1/provider/packs/[packId]/docling-import",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
