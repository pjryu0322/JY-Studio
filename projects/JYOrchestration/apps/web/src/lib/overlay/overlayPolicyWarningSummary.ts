import type { OverlayPolicyWarning } from "@/lib/overlay/overlayPolicyWarning";

function bumpRecord(map: Record<string, number>, key: string): void {
  const k = key.trim() || "(none)";
  map[k] = (map[k] ?? 0) + 1;
}

export function groupOverlayPolicyWarningsByCode(
  warnings: readonly OverlayPolicyWarning[]
): Readonly<Record<string, number>> {
  const m: Record<string, number> = {};
  for (const w of warnings) bumpRecord(m, w.code);
  return m;
}

export function groupOverlayPolicyWarningsByRole(
  warnings: readonly OverlayPolicyWarning[]
): Readonly<Record<string, number>> {
  const m: Record<string, number> = {};
  for (const w of warnings) {
    const rk = w.roleKey === null || w.roleKey === undefined ? "" : String(w.roleKey);
    bumpRecord(m, rk || "(none)");
  }
  return m;
}

export function groupOverlayPolicyWarningsBySource(
  warnings: readonly OverlayPolicyWarning[]
): Readonly<Record<string, number>> {
  const m: Record<string, number> = {};
  for (const w of warnings) bumpRecord(m, w.source);
  return m;
}
