/**
 * Provider-managed pack document language (ko/en only).
 * No automatic detection — providers must select explicitly.
 */

export type PackLanguageCode = "ko" | "en";

export const PACK_LANGUAGE_CODES = ["ko", "en"] as const;

export const PACK_LANGUAGE_INVALID = "PACK_LANGUAGE_INVALID" as const;

export type PackLanguagePrisma = "KO" | "EN";

export function isPackLanguageCode(value: unknown): value is PackLanguageCode {
  return value === "ko" || value === "en";
}

/** Map Prisma PackLanguage (or loose string) to public code. */
export function toPackLanguageCode(
  value: PackLanguagePrisma | PackLanguageCode | string | null | undefined,
): PackLanguageCode | null {
  if (value === "KO" || value === "ko") return "ko";
  if (value === "EN" || value === "en") return "en";
  return null;
}

/** Map public code to Prisma PackLanguage enum value. */
export function toPrismaPackLanguage(
  code: PackLanguageCode | null | undefined,
): PackLanguagePrisma | null {
  if (code === "ko") return "KO";
  if (code === "en") return "EN";
  return null;
}

export type ParsePackLanguageResult =
  | { ok: true; value: PackLanguageCode | null }
  | { ok: false; error: typeof PACK_LANGUAGE_INVALID };

/**
 * Strict API parser for provider PATCH bodies.
 * Accepts only lowercase "ko" | "en", or null/"" to clear.
 * Rejects KO/EN/kr/ja and other aliases → PACK_LANGUAGE_INVALID.
 */
export function parsePackLanguage(value: unknown): ParsePackLanguageResult {
  if (value === null || value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: PACK_LANGUAGE_INVALID };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (trimmed === "ko" || trimmed === "en") {
    return { ok: true, value: trimmed };
  }
  return { ok: false, error: PACK_LANGUAGE_INVALID };
}

export function packLanguageDisplayLabel(
  code: PackLanguageCode | null | undefined,
): string {
  if (code === "ko") return "한국어";
  if (code === "en") return "영어";
  return "미선택";
}
