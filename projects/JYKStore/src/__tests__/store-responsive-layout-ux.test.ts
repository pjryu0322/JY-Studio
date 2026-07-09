import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("store responsive layout", () => {
  it("uses wide responsive shell container", () => {
    const shell = readSource("src/components/MobileShell.tsx");
    assert.ok(shell.includes("max-w-[1120px]"));
    assert.ok(shell.includes("sm:px-6"));
  });
});
