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
  it("uses account role registration client", () => {
    const page = readSource("src/app/(store)/account/page.tsx");
    const account = readSource("src/components/AccountPageClient.tsx");

    assert.ok(page.includes("AccountPageClient"));
    assert.ok(account.includes("ACCOUNT_SECTION_ROLE_REGISTRATION"));
    assert.ok(account.includes("지식팩 운영자"));
    assert.ok(account.includes("운영자 전용"));
  });
});

describe("role-based provider UX", () => {
  it("shows onboarding stepper instead of duplicate numbered list", () => {
    const providerPage = readSource("src/app/(store)/provider/page.tsx");
    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    const packNew = readSource("src/app/(store)/provider/packs/new/page.tsx");

    assert.ok(providerPage.includes("PROVIDER_CENTER_TAGLINE"));
    assert.ok(center.includes("ProviderOnboardingStepper"));
    assert.ok(center.includes("새 지식팩 만들기"));
    assert.ok(packNew.includes("getProviderProfileByClientId"));
    assert.ok(packNew.includes("제공자 프로필이 필요합니다"));
  });
});
