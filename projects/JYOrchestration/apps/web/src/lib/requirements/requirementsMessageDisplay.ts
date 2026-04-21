/**
 * Normalize persisted/API message text for UI display (escaped newlines, etc.).
 * Does not interpret HTML — markdown rendering is handled separately.
 */
export function normalizeRequirementsMessageText(raw: string): string {
  if (!raw) return raw;
  let s = raw;
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\\r\\n/g, "\n");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\\r/g, "\n");
  s = s.replace(/\\t/g, "\t");
  return s;
}
