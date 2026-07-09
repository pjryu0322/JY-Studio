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
    assert.ok(PROVIDER_PROFILE_FOOTER_HINT.includes("새 지식팩"));
  });
});

describe("role-based account UX", () => {
  it("renders basic usage and role sections separately from operator tools in basic menu", () => {
    const account = readSource("src/components/AccountPageContent.tsx");
    const page = readSource("src/app/(store)/account/page.tsx");

    assert.ok(account.includes("ACCOUNT_SECTION_BASIC"));
    assert.ok(account.includes("ACCOUNT_SECTION_ROLES"));
    assert.ok(account.includes("지식팩 제공자"));
    assert.ok(account.includes("지식팩 운영자"));
    assert.ok(account.includes("운영자 전용"));
    assert.ok(!account.includes("운영 사용량 확인") || account.includes("운영자"));
    assert.ok(page.includes("isAdminOpsConfigured"));
    assert.ok(!page.includes("adminOpsUsage") || page.includes("AccountPageContent"));
  });
});

describe("role-based provider UX", () => {
  it("shows onboarding and pack create CTA patterns", () => {
    const providerPage = readSource("src/app/(store)/provider/page.tsx");
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");

    assert.ok(providerPage.includes("PROVIDER_CENTER_ONBOARDING_STEPS"));
    assert.ok(center.includes("새 지식팩 만들기"));
    assert.ok(center.includes("아직 등록한 지식팩이 없습니다"));
    assert.ok(packNew.includes("getProviderProfileByClientId"));
    assert.ok(packNew.includes("제공자 프로필이 필요합니다"));
  });
});
