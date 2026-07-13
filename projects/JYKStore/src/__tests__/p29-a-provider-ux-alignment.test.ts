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

describe("P28.2 / P29-A provider UX alignment", () => {
  it("hides review CTA on materials when no docs", () => {
    const materials = readSource("src/components/ProviderPackMaterialsTab.tsx");
    assert.ok(materials.includes("docs.length > 0"));
    assert.ok(materials.includes("PROVIDER_PACK_GO_TO_REVIEW_TAB"));
  });

  it("hides global onboarding stepper and shows status dashboard", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("ProviderOnboardingStepper"));
    assert.ok(center.includes("ProviderStatusDashboard") || center.includes("현황"));
    assert.ok(!center.includes("fetchProviderPack("));
    assert.ok(!center.includes("packs[0]"));
  });

  it("new pack page gates by role or existing profile without ensure side effects", () => {
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");
    assert.ok(!packNew.includes("ensureProviderProfileForAccount"));
    assert.ok(packNew.includes("isProviderAccountRole"));
    assert.ok(packNew.includes("findProviderProfileForUser"));
    assert.ok(packNew.includes("prisma.user.findUnique"));
  });

  it("avoids implying immediate pack creation in provider copy", () => {
    const copy = readSource("src/lib/role-based-ux-copy.ts");
    assert.ok(!copy.includes("바로 지식팩을 만들 수 있습니다"));
    assert.ok(!copy.includes("로그인하고 지식팩 등록 시작"));
  });
});
