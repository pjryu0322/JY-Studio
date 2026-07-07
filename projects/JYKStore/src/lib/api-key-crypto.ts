import crypto from "crypto";

const API_KEY_PREFIX = "jyk_live_";

export function createPlainApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

export function getApiKeyPrefix(plainKey: string) {
  return plainKey.slice(0, 16);
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
