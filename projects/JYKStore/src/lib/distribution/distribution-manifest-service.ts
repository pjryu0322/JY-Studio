import { randomBytes } from "node:crypto";

/** Stable opaque id for Docling bundles / upload sessions / file rows. */
export function createPayloadId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}
