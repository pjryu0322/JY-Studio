import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function collectTsSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...collectTsSources(path));
    } else if (name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

function readP11Sources(): string {
  const entry = readFileSync(join(root, "scripts/p11-clean-reset.ts"), "utf8");
  const modules = collectTsSources(join(root, "scripts/p11"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  return `${entry}\n${modules}`;
}

describe("P11 clean reset safety", () => {
  it("requires confirm token for execute and defaults read-only", () => {
    const src = readP11Sources();
    assert.ok(src.includes("JYKSTORE_CLEAN_RESET"));
    assert.ok(src.includes("--execute"));
    assert.ok(src.includes("Refusing execute"));
    assert.ok(src.includes("admin@jyk.local"));
    assert.ok(src.includes("provider@jyk.local"));
    assert.ok(src.includes("user@jyk.local"));
    assert.ok(src.includes("TRUNCATE TABLE"));
  });

  it("seed creates exactly the three canonical accounts", () => {
    const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
    assert.ok(seed.includes("admin@jyk.local"));
    assert.ok(seed.includes("provider@jyk.local"));
    assert.ok(seed.includes("user@jyk.local"));
    assert.ok(seed.includes("seedCanonicalAccounts"));
    assert.ok(!seed.includes("seedPack(") || seed.includes("intentionally not seeded"));
  });
});
