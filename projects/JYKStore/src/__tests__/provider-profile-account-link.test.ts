import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveProviderDisplayName,
  validateProviderProfileInput,
} from "../lib/provider-profile-service.ts";
import { buildProviderOnboardingSteps } from "../lib/provider-onboarding-steps.ts";
import { PROVIDER_CENTER_ONBOARDING_STEPS } from "../lib/role-based-ux-copy.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider profile account link", () => {
  it("ensures profile service and wires pack services", () => {
    const service = readSource("src/lib/provider-profile-service.ts");
    const packs = readSource("src/lib/provider-pack-service.ts");
    const session = readSource("src/app/api/v1/auth/session/route.ts");
    const profileRoute = readSource("src/app/api/v1/provider/profile/route.ts");

    assert.ok(service.includes("ensureProviderProfileForAccount"));
    assert.ok(service.includes("findOrEnsureProviderProfileForUser"));
    assert.ok(service.includes("NOT_PROVIDER"));
    assert.ok(service.includes("P2002"));
    assert.ok(service.includes("clientIdForCreate"));
    assert.ok(packs.includes("findOrEnsureProviderProfileForUser"));
    assert.ok(session.includes("ensureProviderProfileForAccount"));
    assert.ok(profileRoute.includes("ensureProviderProfileForAccount"));
    assert.ok(profileRoute.includes("export async function PATCH"));
  });

  it("removes provider profile registration from onboarding", () => {
    const steps = buildProviderOnboardingSteps({
      hasProfile: true,
      packCount: 0,
      sourceDocumentCount: 0,
      knowledgeUnitDraftCount: 0,
      hasReviewingPack: false,
      hasPublishedOrVerifiedPack: false,
    });
    assert.equal(steps[0]?.title, "지식팩 기본정보 입력");
    assert.ok(!steps.some((s) => s.title.includes("제공자 프로필 등록")));
    assert.equal(PROVIDER_CENTER_ONBOARDING_STEPS[0], "지식팩 기본정보 입력");

    const center = readSource("src/components/ProviderCenterPageClient.tsx");
    assert.ok(!center.includes("제공자 프로필 등록"));
    assert.ok(center.includes("fetchProviderProfile"));
  });

  it("links provider profile editing through account profile route", () => {
    const header = readSource("src/components/HeaderProfileButton.tsx");
    const menu = readSource("src/lib/account-menu.ts");
    const editor = readSource("src/components/ProviderProfileEditor.tsx");
    assert.ok(!header.includes("ProviderProfileEditor"));
    assert.ok(menu.includes("제공자 정보"));
    assert.ok(menu.includes("ROUTES.accountProfile"));
    assert.ok(editor.includes("PROVIDER_PROFILE_EDIT_TITLE"));
  });

  it("validates profile fields and displayName fallback", () => {
    assert.equal(
      resolveProviderDisplayName({
        displayName: "",
        userName: "Alice",
        userEmail: "a@example.com",
      }),
      "Alice",
    );
    assert.equal(
      resolveProviderDisplayName({
        displayName: "  ",
        userName: null,
        userEmail: "a@example.com",
      }),
      "a@example.com",
    );
    assert.equal(
      validateProviderProfileInput({
        displayName: "A",
        description: "",
      }),
      null,
    );
    assert.equal(
      validateProviderProfileInput({
        displayName: "",
        description: "",
      }),
      "DISPLAY_NAME_REQUIRED",
    );
  });
});
