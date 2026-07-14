import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

/**
 * SHA-256 of bytes as lowercase hex (64 chars).
 * Must be computed on original bytes as-is — never re-serialize.
 */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Stream SHA-256 without buffering the full object in memory.
 */
export async function sha256HexFromStream(readable: Readable): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of readable) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    hash.update(buf);
  }
  return hash.digest("hex");
}
