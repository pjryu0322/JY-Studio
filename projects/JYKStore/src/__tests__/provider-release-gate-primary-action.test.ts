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

describe("provider release gate primary action", () => {
  it("wires RUN_RELEASE_GATE primary action in inspection tab", () => {
    const readiness = readSource("src/lib/provider-pack-inspection-readiness.ts");
    const tab = readSource("src/components/ProviderPackInspectionTab.tsx");

    assert.ok(readiness.includes('"RUN_RELEASE_GATE"'));
    assert.ok(readiness.includes('primaryActionKind: "RUN_RELEASE_GATE"'));
    assert.ok(tab.includes('primaryActionKind === "RUN_RELEASE_GATE"'));
    assert.ok(tab.includes("evaluateProviderReleaseGateApi"));
  });
});
