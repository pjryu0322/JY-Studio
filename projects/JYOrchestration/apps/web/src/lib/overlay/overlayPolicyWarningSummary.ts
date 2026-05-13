import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";

function countByKey(
  warnings: readonly OverlayPolicyWarning[],
  bucketKey: (w: OverlayPolicyWarning) => string
): Readonly<Record<string, number>> {
  const m: Record<string, number> = {};
  for (const w of warnings) {
    const k = bucketKey(w).trim() || "(none)";
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

export function groupOverlayPolicyWarningsByCode(
  warnings: readonly OverlayPolicyWarning[]
): Readonly<Record<string, number>> {
  return countByKey(warnings, (w) => w.code);
}

export function groupOverlayPolicyWarningsByRole(
  warnings: readonly OverlayPolicyWarning[]
): Readonly<Record<string, number>> {
  return countByKey(warnings, (w) =>
    w.roleKey === null || w.roleKey === undefined ? "" : String(w.roleKey)
  );
}

export function groupOverlayPolicyWarningsBySource(
  warnings: readonly OverlayPolicyWarning[]
): Readonly<Record<string, number>> {
  return countByKey(warnings, (w) => w.source);
}
