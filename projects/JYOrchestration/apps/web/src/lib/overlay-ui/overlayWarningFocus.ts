/**
 * H8.5 — 동일 code 경고 **집중 표시**(반복 완화).
 */

import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";
import type { OverlayUiWarningRow } from "@/lib/overlay-ui/overlayUiAdapter";

export type GroupedOverlayWarningRow = Readonly<{
  code: string;
  severityLabel: string;
  severityTone: OverlayUiBadgeTone;
  messageSample: string;
  count: number;
}>;

export function groupOverlayUiWarningRows(rows: readonly OverlayUiWarningRow[]): readonly GroupedOverlayWarningRow[] {
  const map = new Map<string, { row: OverlayUiWarningRow; count: number }>();
  for (const row of rows) {
    const key = `${row.code}::${row.severityLabel}`;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { row, count: 1 });
  }
  return [...map.values()].map(({ row, count }) => ({
    code: row.code,
    severityLabel: row.severityLabel,
    severityTone: row.severityTone,
    messageSample: row.message,
    count,
  }));
}
