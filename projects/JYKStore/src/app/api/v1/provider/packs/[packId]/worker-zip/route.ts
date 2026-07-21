/**
 * P7.3: Provider ZIP "지식데이터 생성 요청" route (store-only — NOT execution).
 *
 * The Provider only ATTACHES a ZIP and requests generation:
 * - POST multipart/form-data with a single `.zip` file field (`file`) → stores the
 *   requested ZIP to Object Storage (keeps the pack DRAFT). The Worker is NOT run.
 * - GET → returns the current request state (attached file, request status, last
 *   processing result, admin 보완요청 memo) for the Provider screen.
 *
 * Worker EXECUTION authority lives on the Admin side only (see
 * app/api/v1/admin/packs/[packId]/worker-zip/route.ts). This separation prevents
 * Providers from mistaking themselves for the operator of the generation.
 *
 * Legacy Docling JSON/MD manual upload is intentionally NOT part of this path.
 */
import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import {
  getProviderWorkerZipRequestState,
  submitProviderWorkerZipRequest,
  WorkerZipImportServiceError,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import {
  checkWorkerZipContentLength,
  validateWorkerZipFile,
} from "@/lib/python-worker/worker-zip-route-helpers";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  // Pre-parse size guard: reject before formData() reads the body into memory.
  const contentLengthRejection = checkWorkerZipContentLength(
    request.headers.get("content-length"),
  );
  if (contentLengthRejection) {
    return jsonWithClientIdCookie(
      { error: contentLengthRejection.error, code: contentLengthRejection.code },
      clientId,
      { status: contentLengthRejection.status },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return jsonWithClientIdCookie(
      { error: "업로드 형식이 올바르지 않습니다.", code: "INVALID_MULTIPART" },
      clientId,
      { status: 400 },
    );
  }

  const fileRejection = validateWorkerZipFile(file);
  if (fileRejection) {
    return jsonWithClientIdCookie(
      { error: fileRejection.error, code: fileRejection.code },
      clientId,
      { status: fileRejection.status },
    );
  }

  try {
    const bytes = new Uint8Array(await file!.arrayBuffer());
    const result = await submitProviderWorkerZipRequest({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
      bytes,
      originalFileName: file!.name,
    });
    return jsonWithClientIdCookie({ clientId, ...result }, clientId, { status: 200 });
  } catch (error) {
    if (error instanceof WorkerZipImportServiceError) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/worker-zip",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/worker-zip",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

  try {
    const state = await getProviderWorkerZipRequestState({
      userId,
      clientId,
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, ...state }, clientId, { status: 200 });
  } catch (error) {
    if (error instanceof WorkerZipImportServiceError) {
      return jsonWithClientIdCookie(
        { error: error.message, code: error.code },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/worker-zip",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/worker-zip",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
