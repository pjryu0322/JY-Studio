import { createHash } from "node:crypto";

/**
 * SHA-256 of original payload bytes as lowercase hex (64 chars).
 * Must be computed on the uploaded ZIP bytes as-is — never re-serialize.
 */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
