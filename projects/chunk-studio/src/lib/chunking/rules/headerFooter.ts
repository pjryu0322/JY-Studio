import type { Block, CleaningLog } from "@/lib/chunking/types";

function normalizeLine(text: string): string {
  return text
    .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, "DATE")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function removeHeaderFooterNoise(
  blocks: Block[],
  threshold = 0.6,
  topBand = 0.12,
  bottomBand = 0.12,
  forcePositional = false
): { blocks: Block[]; log: CleaningLog } {
  if (blocks.length === 0) {
    return { blocks, log: { method: "freq", params: { threshold }, removed: [] } };
  }

  const hasPosition = blocks.filter((b) => typeof b.page === "number" && b.bbox).length;
  const usePositional = forcePositional || hasPosition >= Math.max(4, Math.floor(blocks.length * 0.3));
  const sourceBlocks = usePositional
    ? blocks.filter((b) => {
        const y = b.bbox?.y;
        if (typeof y !== "number") return false;
        return y <= topBand || y >= 1 - bottomBand;
      })
    : blocks;

  const freq = new Map<string, { count: number; sample: string; pages: number[]; y: number[] }>();
  for (const block of sourceBlocks) {
    const key = normalizeLine(block.text);
    if (key.length < 3) continue;
    const prev = freq.get(key);
    if (prev) {
      prev.count += 1;
      if (typeof block.page === "number") prev.pages.push(block.page);
      if (typeof block.bbox?.y === "number") prev.y.push(block.bbox.y);
    } else {
      freq.set(key, {
        count: 1,
        sample: block.text,
        pages: typeof block.page === "number" ? [block.page] : [],
        y: typeof block.bbox?.y === "number" ? [block.bbox.y] : [],
      });
    }
  }
  const minCount = Math.max(2, Math.floor(sourceBlocks.length * threshold));
  const noisy = new Set<string>();
  for (const [key, value] of freq.entries()) {
    if (value.count >= minCount) noisy.add(key);
  }
  const removedMap = new Map<
    string,
    { text: string; count: number; kind: "header" | "footer" | "repeat_line"; evidence?: Record<string, unknown> }
  >();
  const cleaned = blocks.filter((block) => {
    const key = normalizeLine(block.text);
    if (!noisy.has(key)) return true;
    const y = block.bbox?.y;
    const kind: "header" | "footer" | "repeat_line" =
      typeof y === "number" ? (y <= topBand ? "header" : y >= 1 - bottomBand ? "footer" : "repeat_line") : "repeat_line";
    const found = removedMap.get(key);
    if (found) {
      found.count += 1;
    } else {
      const stat = freq.get(key);
      removedMap.set(key, {
        text: block.text,
        count: 1,
        kind,
        evidence: stat
          ? {
              pages: stat.pages.slice(0, 10),
              y: stat.y.slice(0, 10),
            }
          : undefined,
      });
    }
    return false;
  });
  return {
    blocks: cleaned,
    log: {
      method: usePositional ? "pos+freq" : "freq",
      params: usePositional ? { threshold, topBand, bottomBand } : { threshold },
      removed: Array.from(removedMap.values()),
    },
  };
}

