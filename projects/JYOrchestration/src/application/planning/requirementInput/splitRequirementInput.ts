/**
 * Split normalized requirement input into 1..N candidate descriptions (deterministic).
 */

function stripFillerAroundClause(chunk: string): string {
  let s = chunk.trim();
  s = s.replace(/^(사용자가|사용자는)\s+/u, "");
  s = s.replace(/\s+할\s+수\s+있는\s+/u, " ");
  s = s.replace(/\s+(웹\s*)?서비스를\s*만들고\s*싶다\s*$/u, "");
  s = s.replace(/\s*만들고\s*싶다\s*$/u, "");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 0 ? s : chunk.trim();
}

function splitRawChunks(normalizedText: string): string[] {
  const byHang = normalizedText
    .split(/\s*하고\s+/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (byHang.length >= 2 && byHang.every((p) => p.length >= 8)) {
    return byHang;
  }
  const byComma = normalizedText
    .split(/\s*,\s*/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (byComma.length >= 2 && byComma.every((p) => p.length >= 4)) {
    return byComma;
  }
  return [normalizedText];
}

/** Known two-intent video-meeting phrasing (deterministic template). */
function tryVideoMeetingTwoIntents(chunks: readonly string[]): string[] | null {
  if (chunks.length !== 2) return null;
  const a = chunks[0]!;
  const b = chunks[1]!;
  if (!/화상회의/u.test(`${a} ${b}`)) return null;
  if (/생성/u.test(a) && /참여/u.test(b)) {
    return ["화상회의 생성 기능이 필요하다", "화상회의 참여 기능이 필요하다"];
  }
  return null;
}

/**
 * @returns Stable requirement **descriptions** (not yet ids / drafts).
 */
export function splitRequirementInput(normalizedText: string): readonly string[] {
  if (!normalizedText) return [];
  const raw = splitRawChunks(normalizedText);
  const polished = raw.map((c) => stripFillerAroundClause(c)).filter((d) => d.length > 0);
  const pairForTemplate =
    polished.length >= 2 ? polished : raw.length >= 2 ? raw.map((c) => c.trim()).filter(Boolean) : [];
  const specialized = pairForTemplate.length >= 2 ? tryVideoMeetingTwoIntents(pairForTemplate) : null;
  const descriptions = (specialized ?? (polished.length > 0 ? polished : raw)).filter((d) => d.length > 0);
  return descriptions.length > 0 ? descriptions : [normalizedText.trim()].filter(Boolean);
}
