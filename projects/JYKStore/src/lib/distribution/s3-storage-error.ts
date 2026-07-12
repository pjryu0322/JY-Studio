import { PayloadServiceError } from "@/lib/distribution/payload-errors";

export type S3StorageOperation = "put" | "get" | "delete" | "head" | "probe";

export type S3StorageErrorClass =
  | "object-not-found"
  | "access-denied"
  | "bucket-missing"
  | "unavailable";

type S3ErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  $metadata?: { httpStatusCode?: unknown };
};

function errorTokens(error: unknown): { names: string[]; status?: number; message: string } {
  const candidate = (error ?? {}) as S3ErrorLike;
  const names = [candidate.name, candidate.code]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
  const status =
    typeof candidate.$metadata?.httpStatusCode === "number"
      ? candidate.$metadata.httpStatusCode
      : undefined;
  return {
    names,
    status,
    message: typeof candidate.message === "string" ? candidate.message.toLowerCase() : "",
  };
}

function hasName(names: string[], ...candidates: string[]): boolean {
  return candidates.some((candidate) => names.includes(candidate.toLowerCase()));
}

/**
 * Classify S3/MinIO errors with operation-aware priority.
 * Never treat NoSuchBucket as object-not-found solely because of HTTP 404.
 */
export function classifyS3StorageError(
  error: unknown,
  operation: S3StorageOperation,
): S3StorageErrorClass {
  const { names, status, message } = errorTokens(error);

  if (
    hasName(names, "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch") ||
    status === 403
  ) {
    return "access-denied";
  }

  if (hasName(names, "NoSuchBucket")) {
    return "bucket-missing";
  }

  if (hasName(names, "NoSuchKey")) {
    return "object-not-found";
  }

  const genericNotFound = hasName(names, "NotFound") || status === 404;
  if (genericNotFound) {
    if (operation === "probe") return "bucket-missing";
    if (operation === "head" || operation === "get") return "object-not-found";
    // put/delete generic 404 is treated as storage/bucket failure, not a missing payload object.
    return "bucket-missing";
  }

  if (
    status === 429 ||
    (status !== undefined && status >= 500) ||
    hasName(
      names,
      "SlowDown",
      "Timeout",
      "TimeoutError",
      "NetworkingError",
      "RequestTimeout",
    ) ||
    /timeout|timed out|network|econn|enotfound|eai_again|socket hang up/.test(message)
  ) {
    return "unavailable";
  }

  return "unavailable";
}

/** True only for object-level missing (never NoSuchBucket). */
export function isS3ObjectNotFoundError(
  error: unknown,
  operation: S3StorageOperation = "get",
): boolean {
  return classifyS3StorageError(error, operation) === "object-not-found";
}

export function mapS3StorageError(
  error: unknown,
  operation: S3StorageOperation,
): PayloadServiceError {
  const classification = classifyS3StorageError(error, operation);
  if (classification === "object-not-found") {
    return new PayloadServiceError(
      "PAYLOAD_NOT_FOUND",
      "Object Storage에서 Payload를 찾을 수 없습니다.",
      404,
    );
  }
  if (classification === "access-denied") {
    return new PayloadServiceError(
      "PAYLOAD_STORAGE_ACCESS_DENIED",
      `Object Storage ${operation} 권한이 거부되었습니다.`,
      503,
    );
  }
  if (classification === "bucket-missing") {
    return new PayloadServiceError(
      "PAYLOAD_STORAGE_UNAVAILABLE",
      "Object Storage bucket is unavailable",
      503,
    );
  }
  return new PayloadServiceError(
    "PAYLOAD_STORAGE_UNAVAILABLE",
    "Object Storage를 일시적으로 사용할 수 없습니다.",
    503,
  );
}

export function describeS3StorageProbeError(error: unknown): string {
  switch (classifyS3StorageError(error, "probe")) {
    case "access-denied":
      return "Object Storage access denied";
    case "bucket-missing":
      return "Object Storage bucket not found";
    case "object-not-found":
      return "Object Storage bucket not found";
    default:
      return "Object Storage network unavailable";
  }
}
