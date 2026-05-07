/**
 * Writes plain text to the system clipboard.
 * Uses `navigator.clipboard` when available, then falls back to a hidden textarea + `document.execCommand('copy')`.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  const raw = String(text ?? "");
  if (!raw.length) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(raw);
      return true;
    }
  } catch {
    /* fall through */
  }

  if (typeof document === "undefined") return false;

  try {
    const ta = document.createElement("textarea");
    ta.value = raw;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, raw.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
