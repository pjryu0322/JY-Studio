/** 레일 한 글자 글리프 (한글 라벨 첫 글자). */
export function workflowStepRailGlyph(label: string): string {
  const t = label.trim();
  if (!t) return "•";
  return t.slice(0, 1);
}
