/**
 * P7: ZIP Worker import route (synchronous minimal connection).
 *
 * POST multipart/form-data with a single `.zip` file field (`file`). The route
 * spills the upload to a temp file and awaits `runProviderWorkerZipImport`
 * (Python Worker → validate → Object Storage → DB/pgvector reflection).
 *
 * This is intentionally SYNCHRONOUS for this round — the route awaits the service
 * directly. Async job handoff (enqueue + poll worker) is deferred to P7.1; see
 * docs/python-worker-zip-import.md.
 *
 * Role separation: this is the ZIP Worker path, NOT the legacy Docling import.
 *
 * P7.1: reject oversized bodies by `Content-Length` BEFORE `formData()` parses
 * them; validation/response mapping live in `worker-zip-route-helpers` (unit
 * tested there).
 */
import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { withTempFileFromStream } from "@/lib/object-storage/stream-object-helpers";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import {
  runProviderWorkerZipImport,
  WorkerZipImportServiceError,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import {
  checkWorkerZipContentLength,
  mapWorkerZipImportHttpResponse,
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
    const nodeStream = Readable.fromWeb(file!.stream() as Parameters<typeof Readable.fromWeb>[0]);
    const result = await withTempFileFromStream(nodeStream, (inputZipPath) =>
      runProviderWorkerZipImport({
        userId,
        clientId,
        packId: packId?.trim() ?? "",
        inputZipPath,
      }),
    );

    const mapped = mapWorkerZipImportHttpResponse(result);
    return jsonWithClientIdCookie({ clientId, ...mapped.body }, clientId, {
      status: mapped.status,
    });
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
