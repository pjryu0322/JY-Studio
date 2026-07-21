/**
 * P7.1: pure, testable helpers for the ZIP Worker upload route.
 *
 * Kept framework-free (no NextRequest/Response) so the validation/response
 * mapping can be unit-tested without the Next runtime. The route wires these in.
 */
import type { ProviderWorkerZipImportResult } from "@/lib/python-worker/worker-zip-import-provider-service";

/** Reject uploads larger than this before spilling them to disk / into memory. */
export const MAX_WORKER_ZIP_UPLOAD_BYTES = 200 * 1024 * 1024;

export type WorkerZipUploadRejection = {
  status: number;
  error: string;
  code: string;
};

/**
 * Pre-parse guard: reject by `Content-Length` BEFORE calling `formData()` so an
 * oversized multipart body is never parsed into memory. Missing/invalid headers
 * fall through (the post-parse `file.size` guard still applies).
 */
export function checkWorkerZipContentLength(
  contentLengthHeader: string | null | undefined,
  maxBytes: number = MAX_WORKER_ZIP_UPLOAD_BYTES,
): WorkerZipUploadRejection | null {
  if (!contentLengthHeader) return null;
  const parsed = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed > maxBytes) {
    return {
      status: 413,
      error: "ZIP 파일이 허용 크기를 초과했습니다.",
      code: "WORKER_ZIP_FILE_TOO_LARGE",
    };
  }
  return null;
}

/** Post-parse guard: validate the uploaded file's presence, extension and size. */
export function validateWorkerZipFile(
  file: { name?: string | null; size?: number | null } | null | undefined,
  maxBytes: number = MAX_WORKER_ZIP_UPLOAD_BYTES,
): WorkerZipUploadRejection | null {
  if (!file) {
    return { status: 400, error: "ZIP 파일이 필요합니다.", code: "FILE_REQUIRED" };
  }
  const name = file.name ?? "";
  if (!name.toLowerCase().endsWith(".zip")) {
    return { status: 400, error: "ZIP(.zip) 파일만 업로드할 수 있습니다.", code: "INVALID_FILE_TYPE" };
  }
  if (typeof file.size === "number" && file.size > maxBytes) {
    return {
      status: 413,
      error: "ZIP 파일이 허용 크기를 초과했습니다.",
      code: "WORKER_ZIP_FILE_TOO_LARGE",
    };
  }
  return null;
}

/** Map a service result to an HTTP status + body. Processed-but-failed → 422. */
export function mapWorkerZipImportHttpResponse(result: ProviderWorkerZipImportResult): {
  status: number;
  body: ProviderWorkerZipImportResult;
} {
  return { status: result.ok ? 200 : 422, body: result };
}
