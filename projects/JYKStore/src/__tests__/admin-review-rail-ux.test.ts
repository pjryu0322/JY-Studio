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

describe("admin review rail UX (workbench step1)", () => {
  it("labels queue as 자료 접수 and generation/quality as 생성·품질보정", () => {
    const rail = readSource("src/lib/role-workspace/admin-review-rail.ts");
    assert.ok(rail.includes('"자료 접수"'));
    assert.ok(rail.includes('"생성·품질보정"'));
    assert.ok(rail.includes('"제공자 검토"') || rail.includes('"제공자 검토 대기"'));
    assert.ok(rail.includes('"승인·게시"'));
    assert.ok(rail.includes('"서비스 검증"'));
  });

  it("preserves step query ids for URL compatibility", () => {
    const rail = readSource("src/lib/role-workspace/admin-review-rail.ts");
    for (const step of [
      "queue",
      "generation",
      "quality",
      "providerConfirm",
      "searchValidation",
      "decision",
      "publish",
    ]) {
      assert.ok(rail.includes(`?step=${step}`), `missing step=${step}`);
    }
  });
});
