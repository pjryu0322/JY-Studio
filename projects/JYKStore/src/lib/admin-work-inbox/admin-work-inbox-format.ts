import type { AdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";

export type WorkInboxSortKey =
  | "index"
  | "packName"
  | "providerName"
  | "requestedAt"
  | "acceptedAt"
  | "displayStatus";

export type WorkInboxSortState = {
  key: WorkInboxSortKey;
  dir: "asc" | "desc";
};

export function formatInboxDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

/** Table columns — date only (no time). */
export function formatInboxDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ko-KR", { dateStyle: "medium" });
}

export function qualityStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "PASS":
      return "통과";
    case "WARNING":
      return "주의";
    case "FAIL":
      return "차단(FAIL)";
    case "IN_PROGRESS":
      return "진행 중";
    case "NOT_CHECKED":
    default:
      return "미점검";
  }
}

function compareNullableText(a: string | null | undefined, b: string | null | undefined): number {
  return (a?.trim() || "").localeCompare(b?.trim() || "", "ko", { sensitivity: "base" });
}

function compareNullableDate(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a ? Date.parse(a) : Number.NaN;
  const tb = b ? Date.parse(b) : Number.NaN;
  const aOk = Number.isFinite(ta);
  const bOk = Number.isFinite(tb);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return ta - tb;
}

export function sortWorkInboxItems(
  items: readonly AdminWorkInboxItemViewModel[],
  sort: WorkInboxSortState,
): AdminWorkInboxItemViewModel[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case "index":
        cmp = a.packId.localeCompare(b.packId);
        break;
      case "packName":
        cmp = compareNullableText(a.packName, b.packName);
        break;
      case "providerName":
        cmp = compareNullableText(a.providerName, b.providerName);
        break;
      case "requestedAt":
        cmp = compareNullableDate(a.requestedAt, b.requestedAt);
        break;
      case "acceptedAt":
        cmp = compareNullableDate(a.acceptedAt, b.acceptedAt);
        break;
      case "displayStatus":
        cmp = compareNullableText(a.displayStatus, b.displayStatus);
        break;
      default:
        cmp = 0;
    }
    if (cmp === 0) cmp = a.packName.localeCompare(b.packName, "ko");
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}
