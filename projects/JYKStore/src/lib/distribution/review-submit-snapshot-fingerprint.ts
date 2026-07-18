/**
 * P5.1.3: Deterministic fingerprint for review submit snapshots.
 * Used to bind external Object Storage integrity checks to the DB snapshot
 * re-read inside the approval transaction.
 */

import { createHash } from "node:crypto";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "bigint") {
    throw new TypeError("BigInt is not allowed in review submit snapshot canonicalization");
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item)).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const next = canonicalize(value[key]);
      if (next !== undefined) {
        out[key] = next;
      }
    }
    return out;
  }
  return String(value);
}

/** Canonical UTF-8 JSON: sorted object keys, preserved array order, no undefined. */
export function canonicalizeReviewSubmitSnapshot(
  snapshot: DoclingBundleReviewSubmitSnapshot,
): string {
  return JSON.stringify(canonicalize(snapshot));
}

/** SHA-256 lowercase hex of the canonical snapshot JSON. */
export function computeReviewSubmitSnapshotFingerprint(
  snapshot: DoclingBundleReviewSubmitSnapshot,
): string {
  return createHash("sha256")
    .update(canonicalizeReviewSubmitSnapshot(snapshot), "utf8")
    .digest("hex");
}
