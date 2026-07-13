import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PROVIDER_CENTER_ONBOARDING_STEPS,
  PROVIDER_PROFILE_FOOTER_HINT,
} from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("role-based UX copy", () => {
  it("defines provider onboarding steps", () => {
    assert.equal(PROVIDER_CENTER_ONBOARDING_STEPS.length, 4);
    assert.deepEqual([...PROVIDER_CENTER_ONBOARDING_STEPS], [
      "지식팩 기본정보 입력",
      "기존 자료 확인",
      "검수 요청",
      "운영자 승인 후 공개",
    ]);
    assert.ok(PROVIDER_PROFILE_FOOTER_HINT.includes("상단 프로필"));
  });
});

describe("role-based account UX", () => {
  it("makes bottom account tab and account page admin-only for registered account management", () => {
    const page = readSource("src/app/(store)/account/page.tsx");
    const account = readSource("src/components/AccountPageClient.tsx");
    const nav = readSource("src/components/BottomTabNav.tsx");
    const panel = readSource("src/components/AdminAccountManagementPanel.tsx");

    assert.ok(page.includes("AccountPageClient"));
    assert.ok(account.includes("AdminAccountManagementPanel"));
    assert.ok(account.includes("관리자 전용 메뉴입니다"));
    assert.ok(account.includes("등록 계정 관리") || panel.includes("등록 계정 관리"));
    assert.ok(nav.includes('tab.key === "account" ? isAdmin') || nav.includes('tab.key === "account") return isAdmin'));
    assert.ok(nav.includes("isAdminAccountRole"));
  });

  it("shows provider center in bottom nav for knowledge providers", () => {
    const nav = readSource("src/components/BottomTabNav.tsx");
    const routes = readSource("src/lib/routes.ts");
    assert.ok(routes.includes('key: "provider"'));
    assert.ok(routes.includes('label: "제공자 센터"'));
    assert.ok(nav.includes("isProviderAccountRole"));
    assert.ok(nav.includes('tab.key === "provider"'));
  });
});

describe("role-based provider UX", () => {
  it("shows onboarding stepper and payload registration CTA", () => {
    const providerPage = readSource("src/app/(store)/provider/page.tsx");
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");

    assert.ok(providerPage.includes("PROVIDER_CENTER_TAGLINE"));
    assert.ok(center.includes("ProviderOnboardingStepper"));
    assert.ok(!center.includes("새 지식팩 만들기"));
    assert.ok(!center.includes("PROVIDER_PAYLOAD_IMPORT_PREP_TITLE"));
    assert.ok(!center.includes("PROVIDER_CENTER_REGISTERED_TITLE"));
    assert.ok(center.includes("PROVIDER_PACK_REGISTER_CTA"));
    assert.ok(packNew.includes("getUserIdFromCookies"));
    assert.ok(packNew.includes("ProviderRequiredCard"));
    assert.ok(packNew.includes("ProviderPackCreateForm"));
    assert.ok(!packNew.includes("ensureProviderProfileForAccount"));
  });
});
