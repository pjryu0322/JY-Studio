import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function generatePasswordResetRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
