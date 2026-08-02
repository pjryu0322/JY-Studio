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
    assert.equal(PROVIDER_CENTER_ONBOARDING_STEPS.length, 5);
    assert.deepEqual([...PROVIDER_CENTER_ONBOARDING_STEPS], [
      "기본정보",
      "자료 등록",
      "유통정보",
      "검수 요청",
      "승인·공개",
    ]);
    assert.ok(PROVIDER_PROFILE_FOOTER_HINT.includes("상단 프로필"));
  });
});

describe("role-based account UX", () => {
  it("makes bottom account tab and account page admin-only for registered account management", () => {
    const page = readSource("src/app/(store)/account/page.tsx");
    const settingsPage = readSource("src/app/(store)/settings/page.tsx");
    const account = readSource("src/components/AccountPageClient.tsx");
    const nav = readSource("src/components/BottomTabNav.tsx");
    const panel = readSource("src/components/AdminAccountManagementPanel.tsx");
    const routes = readSource("src/lib/routes.ts");

    assert.ok(page.includes("AccountPageClient"));
    assert.ok(!page.includes("ConsumerWorkspaceShell"));
    assert.ok(settingsPage.includes("redirect(ROUTES.adminOps)"));
    assert.ok(account.includes("AdminAccountManagementPanel"));
    assert.ok(account.includes("관리자 전용 메뉴입니다"));
    assert.ok(panel.includes("등록 계정 관리"));
    assert.ok(routes.includes('key: "opsUsage"'));
    assert.ok(routes.includes('key: "opsAudit"'));
    assert.ok(routes.includes('key: "ops"'));
    assert.ok(routes.includes('label: "운영 사용량"'));
    assert.ok(routes.includes('label: "AuditLog"'));
    assert.ok(routes.includes('label: "공개/운영"'));
    assert.ok(!routes.includes('key: "settings"'));
    assert.ok(nav.includes("appRailTabsForRole"));
    assert.ok(nav.includes('role === "ADMIN"'));
    assert.ok(nav.includes('"opsUsage"'));
    assert.ok(nav.includes('"opsAudit"'));
    assert.ok(nav.includes('"ops"'));
    assert.ok(!nav.includes('"settings"'));
  });

  it("shows provider center and review-request rail for knowledge providers", () => {
    const nav = readSource("src/components/BottomTabNav.tsx");
    const routes = readSource("src/lib/routes.ts");
    assert.ok(routes.includes('key: "provider"'));
    assert.ok(routes.includes('key: "providerReview"'));
    assert.ok(routes.includes('label: "제공자 센터"'));
    assert.ok(routes.includes('label: "검토대상"'));
    assert.ok(routes.includes("providerReviews"));
    assert.ok(nav.includes("isProviderAccountRole") || nav.includes("appRailTabsForRole"));
    assert.ok(nav.includes("appRailTabsForRole"));
    assert.ok(nav.includes('"provider"'));
    assert.ok(nav.includes('"providerReview"'));
    assert.ok(nav.includes("providerReviewBadge") || nav.includes("providerReviewRequested"));
    assert.ok(nav.includes("RailEdgeArrow") || nav.includes("메뉴 감추기"));
    assert.ok(!nav.includes("PanelCollapseIcon"));
    const adminBlock = nav.slice(nav.indexOf('role === "ADMIN"'), nav.indexOf('role === "PROVIDER"'));
    assert.ok(!adminBlock.includes('"provider"'));
    assert.ok(!adminBlock.includes('"providerReview"'));
  });
});

describe("role-based provider UX", () => {
  it("shows status dashboard and pack registration CTA", () => {
    const providerPage = readSource("src/app/(store)/provider/page.tsx");
    const chrome = readSource("src/lib/store-page-chrome.ts");
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");

    assert.ok(providerPage.includes("ProviderCenterPageClient"));
    assert.ok(chrome.includes("PROVIDER_CENTER_TAGLINE"));
    assert.ok(chrome.includes("지식팩 제공자 센터"));
    assert.ok(!center.includes("ProviderOnboardingStepper"));
    assert.ok(center.includes("현황") || center.includes("ProviderStatusDashboard"));
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
