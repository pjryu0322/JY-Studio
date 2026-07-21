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
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

/** Reject oversized uploads before spilling them to disk. */
const MAX_WORKER_ZIP_UPLOAD_BYTES = 200 * 1024 * 1024;

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId } = await context.params;

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

  if (!file) {
    return jsonWithClientIdCookie(
      { error: "ZIP 파일이 필요합니다.", code: "FILE_REQUIRED" },
      clientId,
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return jsonWithClientIdCookie(
      { error: "ZIP(.zip) 파일만 업로드할 수 있습니다.", code: "INVALID_FILE_TYPE" },
      clientId,
      { status: 400 },
    );
  }
  if (file.size > MAX_WORKER_ZIP_UPLOAD_BYTES) {
    return jsonWithClientIdCookie(
      { error: "ZIP 파일이 허용 크기를 초과했습니다.", code: "WORKER_ZIP_FILE_TOO_LARGE" },
      clientId,
      { status: 413 },
    );
  }

  try {
    const nodeStream = Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]);
    const result = await withTempFileFromStream(nodeStream, (inputZipPath) =>
      runProviderWorkerZipImport({
        userId,
        clientId,
        packId: packId?.trim() ?? "",
        inputZipPath,
      }),
    );

    return jsonWithClientIdCookie({ clientId, ...result }, clientId, {
      status: result.ok ? 200 : 422,
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
