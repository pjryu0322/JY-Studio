import type { Block } from "./types";

export interface BlockWithSection {
  block: Block;
  sectionPath: string[];
}

export function attachSectionPath(blocks: Block[]): BlockWithSection[] {
  const stack: Array<{ level: number; title: string }> = [];
  let lastLevel = 1;

  return blocks.map((block) => {
    if (block.type === "heading") {
      const rawLevel = block.level ?? 3;
      const level =
        rawLevel > lastLevel + 1 ? lastLevel + 1 : Math.max(1, rawLevel);
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      stack.push({ level, title: block.text });
      lastLevel = level;
    }
    return {
      block,
      sectionPath: stack.map((s) => s.title),
    };
  });
}

