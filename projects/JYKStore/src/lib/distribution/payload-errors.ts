export const PAYLOAD_ERROR_CODES = [
  "PAYLOAD_FILE_REQUIRED",
  "PAYLOAD_FILE_TOO_LARGE",
  "PAYLOAD_INVALID_ZIP",
  "PAYLOAD_UNSAFE_PATH",
  "PAYLOAD_TOO_MANY_ENTRIES",
  "PAYLOAD_UNSUPPORTED_PROFILE",
  "PAYLOAD_GENERATOR_MISMATCH",
  "PAYLOAD_ENTRYPOINT_MISSING",
  "PAYLOAD_INVALID_CONTENT",
  "PAYLOAD_ALREADY_REGISTERED",
  "PAYLOAD_NOT_FOUND",
  "PAYLOAD_NOT_VALID",
  "DISTRIBUTION_METADATA_REQUIRED",
  "LICENSE_REQUIRED",
  "SOURCE_REQUIRED",
  "MANIFEST_NOT_READY",
  "PACK_NOT_EDITABLE",
  "PROVIDER_AUTH_REQUIRED",
  "NOT_FOUND",
  "PROFILE_REQUIRED",
  "NOT_DRAFT",
  "INCOMPLETE",
] as const;

export type PayloadErrorCode = (typeof PAYLOAD_ERROR_CODES)[number];

export class PayloadServiceError extends Error {
  readonly code: PayloadErrorCode;
  readonly httpStatus: number;

  constructor(code: PayloadErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = "PayloadServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function isPayloadServiceError(error: unknown): error is PayloadServiceError {
  return error instanceof PayloadServiceError;
}
