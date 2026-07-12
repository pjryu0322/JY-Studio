import { PayloadServiceError } from "@/lib/distribution/payload-errors";

export type S3StorageOperation = "put" | "get" | "delete" | "head" | "probe";

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

export function isS3ObjectNotFoundError(error: unknown): boolean {
  const { names, status } = errorTokens(error);
  return status === 404 || names.some((name) => name === "nosuchkey" || name === "notfound");
}

export function classifyS3StorageError(
  error: unknown,
): "not-found" | "access-denied" | "bucket-missing" | "unavailable" {
  const { names, status, message } = errorTokens(error);
  if (isS3ObjectNotFoundError(error)) return "not-found";
  if (names.some((name) => name === "accessdenied" || name === "invalidaccesskeyid" || name === "signaturedoesnotmatch") || status === 403) {
    return "access-denied";
  }
  if (names.some((name) => name === "nosuchbucket")) return "bucket-missing";
  if (
    status === 429 ||
    (status !== undefined && status >= 500) ||
    names.some((name) =>
      ["slowdown", "timeout", "timeouterror", "networkingerror", "requesttimeout"].includes(name),
    ) ||
    /timeout|timed out|network|econn|enotfound|eai_again|socket hang up/.test(message)
  ) {
    return "unavailable";
  }
  return "unavailable";
}

export function mapS3StorageError(error: unknown, operation: S3StorageOperation): PayloadServiceError {
  const classification = classifyS3StorageError(error);
  if (classification === "not-found") {
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
  return new PayloadServiceError(
    "PAYLOAD_STORAGE_UNAVAILABLE",
    "Object Storage를 일시적으로 사용할 수 없습니다.",
    503,
  );
}

export function describeS3StorageProbeError(error: unknown): string {
  switch (classifyS3StorageError(error)) {
    case "access-denied":
      return "Object Storage access denied";
    case "bucket-missing":
      return "Object Storage bucket not found";
    case "not-found":
      return "Object Storage bucket not found";
    default:
      return "Object Storage network unavailable";
  }
}
