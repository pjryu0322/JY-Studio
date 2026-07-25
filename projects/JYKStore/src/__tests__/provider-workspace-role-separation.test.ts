import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildProviderPackProgress,
} from "../lib/provider-pack-progress.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider workspace role separation", () => {
  it("keeps my-packs consumer-only and redirects provider accounts", () => {
    const myPacks = readSource("src/components/MyPacksPageClient.tsx");
    assert.ok(myPacks.includes("MY_PACKS_PROVIDER_REDIRECT_TITLE"));
    assert.ok(myPacks.includes("isProviderAccountRole"));
    assert.ok(myPacks.includes("ROUTES.provider"));
    assert.ok(myPacks.includes("MyPackCard"));
    assert.ok(!myPacks.includes("fetchProviderPacks"));
    assert.ok(!myPacks.includes("보관한 지식팩"));
    assert.ok(!myPacks.includes("연동하기"));
  });

  it("keeps consumer CTAs on MyPackCard for user screens", () => {
    const card = readSource("src/components/MyPackCard.tsx");
    assert.ok(card.includes("ConnectActionButton") || card.includes("연동"));
    assert.ok(card.includes("다운로드") || card.includes("download"));
    assert.ok(card.includes("Pack ID") || card.includes("CopyButton"));
  });

  it("provider center avoids consumer catalog CTAs", () => {
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("보관한 지식팩"));
    assert.ok(!center.includes("연동하기"));
    assert.ok(center.includes("PROVIDER_CENTER_BEFORE_PROFILE_BODY"));
    assert.ok(!center.includes("Boolean(session.providerProfile)"));
  });

  it("maps provider CTAs to workflow language by state", () => {
    const changes = buildProviderPackProgress({
      packId: "p1",
      packStatus: "DRAFT",
      name: "P",
      categoryId: "c",
      shortDescription: "s",
      description: "d",
      language: "ko",
      latestRejectionReason: "보완 필요",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: null,
    });
    assert.ok(changes.actions.some((a) => a.label === "보완사항 보기"));

    const published = buildProviderPackProgress({
      packId: "p2",
      packStatus: "PUBLISHED",
      name: "P",
      categoryId: "c",
      shortDescription: "s",
      description: "d",
      language: "ko",
      workingVersion: {
        id: "v1",
        version: "0.1.0",
        sourceDocumentCount: 1,
        materialReady: true,
        distributionReady: true,
      },
      publishedVersion: { id: "v1", version: "0.1.0" },
    });
    assert.ok(published.actions.some((a) => a.label === "공개 정보 관리"));
    assert.ok(!published.actions.some((a) => a.label === "연동하기"));
  });
});

describe("one account one role UX", () => {
  it("scopes rail tabs by role and hides consumer catalog for providers", () => {
    const nav = readSource("src/components/BottomTabNav.tsx");
    const copy = readSource("src/lib/role-based-ux-copy.ts");
    const profile = readSource("src/components/AccountProfilePageClient.tsx");
    const role = readSource("src/lib/account-role.ts");
    const home = readSource("src/app/(store)/page.tsx");
    const providerLayout = readSource("src/app/(store)/provider/layout.tsx");

    assert.ok(nav.includes("appRailTabsForRole"));
    assert.ok(nav.includes('role === "PROVIDER"'));
    assert.ok(nav.includes('role === "ADMIN"'));
    assert.ok(nav.includes('"provider"'));
    assert.ok(nav.includes('"providerReview"'));
    assert.ok(nav.includes('key === "today"') || nav.includes('tab.key === "today"'));
    assert.ok(nav.includes("RailEdgeArrow") || nav.includes("translate-x-1/2"));
    assert.ok(!nav.includes("PanelCollapseIcon"));
    // Admin rail must not include provider center (admins cannot act as providers).
    const adminBlock = nav.slice(nav.indexOf('role === "ADMIN"'), nav.indexOf('role === "PROVIDER"'));
    assert.ok(adminBlock.includes('"admin"'));
    assert.ok(adminBlock.includes('"categories"'));
    assert.ok(adminBlock.includes('"account"'));
    assert.ok(adminBlock.includes('"opsUsage"'));
    assert.ok(adminBlock.includes('"opsAudit"'));
    assert.ok(adminBlock.includes('"ops"'));
    assert.ok(!adminBlock.includes('"settings"'));
    assert.ok(!adminBlock.includes('"provider"'));
    assert.ok(!adminBlock.includes('"providerReview"'));
    assert.ok(providerLayout.includes("isAdminAccountRole"));
    assert.ok(providerLayout.includes("ROUTES.admin"));
    assert.ok(copy.includes("별도 계정"));
    assert.ok(copy.includes("ACCOUNT_ROLE_SEPARATION_NOTE"));
    assert.ok(profile.includes("ACCOUNT_USER_NEEDS_PROVIDER_ACCOUNT"));
    assert.ok(profile.includes("canEditProviderProfile"));
    assert.ok(profile.includes("isProviderAccountRole(accountRole)"));
    assert.ok(!profile.includes("isAdminAccountRole(accountRole)"));
    assert.ok(role.includes("void input.hasProviderProfile"));
    assert.ok(home.includes("ROUTES.provider"));
    assert.ok(home.includes("isProviderAccountRole"));
  });
});
