/**
 * 작업메모 HTML → 요약 LLM용 플레인 텍스트(서버·클라이언트 공용, DOMParser 없음).
 */
export function workNoteHtmlToPlainForSummary(html: string, maxChars: number): string {
  const raw = String(html ?? "");
  let s = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<img[^>]*>/gi, " [이미지] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 ? String.fromCharCode(code) : "";
    })
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  if (s.length > maxChars) s = `${s.slice(0, maxChars)}…`;
  return s;
}
