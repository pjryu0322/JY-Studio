const NFR_MARKER = "\n\n비기능 요구사항:\n";

export function splitSuccessCriteriaAndNfr(raw: string | null | undefined): { success: string; nfr: string } {
  const s = String(raw ?? "");
  const i = s.indexOf(NFR_MARKER);
  if (i < 0) return { success: s.trim(), nfr: "" };
  return { success: s.slice(0, i).trim(), nfr: s.slice(i + NFR_MARKER.length).trim() };
}

export function joinSuccessCriteriaAndNfr(success: string, nfr: string): string {
  const a = success.trim();
  const b = nfr.trim();
  if (!b) return a;
  if (!a) return `${NFR_MARKER}${b}`;
  return `${a}${NFR_MARKER}${b}`;
}
