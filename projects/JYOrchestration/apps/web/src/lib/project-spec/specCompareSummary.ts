import { parseMarkdownToSections } from "@/lib/project-spec/parseMarkdownSections";

/** 섹션 키 기준 Added / Removed / Modified 개수 (전체 문서 비교 요약용) */
export function summarizeMarkdownSectionDiff(markdownA: string, markdownB: string): {
  added: number;
  removed: number;
  modified: number;
} {
  const a = parseMarkdownToSections(markdownA).sections;
  const b = parseMarkdownToSections(markdownB).sections;
  const mapA = new Map(a.map((s) => [s.key, s]));
  const mapB = new Map(b.map((s) => [s.key, s]));
  const keys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  let added = 0;
  let removed = 0;
  let modified = 0;
  for (const k of keys) {
    const sa = mapA.get(k);
    const sb = mapB.get(k);
    if (!sa && sb) {
      added += 1;
    } else if (sa && !sb) {
      removed += 1;
    } else if (sa && sb && sa.content.trim() !== sb.content.trim()) {
      modified += 1;
    }
  }
  return { added, removed, modified };
}
