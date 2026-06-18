import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");
const BANNED = [
  "Mock JSON fallback",
  "Mock fallback",
  "Local State + JSON Mock",
  "Mock fallback 단계",
  "Mock 기반 구현",
  "현재 단계에서는 DB 연동을 필수로 하지 않음",
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(tsx|ts|mdx?)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("planning user-flow mock copy guard", () => {
  it("does not expose banned mock fallback phrases in src", () => {
    const files = walk(ROOT);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const phrase of BANNED) {
        if (text.includes(phrase)) {
          hits.push(`${file}: ${phrase}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
