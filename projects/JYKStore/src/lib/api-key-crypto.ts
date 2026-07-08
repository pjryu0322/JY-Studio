import crypto from "crypto";

const API_KEY_PREFIX = "jyk_live_";

export function createPlainApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

export function getApiKeyPrefix(plainKey: string) {
  return plainKey.slice(0, 16);
}

/** Masked display form for UI/API lists. Never log the raw key. */
export function maskApiKey(plainOrPrefix: string): string {
  const value = plainOrPrefix.trim();
  if (value.length <= 12) {
    return `${value.slice(0, Math.min(4, value.length))}…`;
  }
  if (value.startsWith(API_KEY_PREFIX) && value.length > 16) {
    return `${value.slice(0, 16)}…${value.slice(-4)}`;
  }
  // keyPrefix (16 chars) or truncated safe display
  const head = value.slice(0, 12);
  const tail = value.length >= 4 ? value.slice(-4) : "";
  return tail ? `${head}…${tail}` : `${head}…`;
}

export function hashApiKey(plainKey: string) {
  const secret = process.env.JYKSTORE_API_KEY_SECRET;
  if (secret) {
    return crypto.createHmac("sha256", secret).update(plainKey).digest("hex");
  }
  return crypto.createHash("sha256").update(plainKey).digest("hex");
}

export function safeCompareHash(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
