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

describe("account role registration UX", () => {
  it("keeps account page admin-only without guest role registration CTAs", () => {
    const account = readSource("src/components/AccountPageClient.tsx");
    assert.ok(account.includes("관리자 전용 메뉴입니다"));
    assert.ok(account.includes("AdminAccountManagementPanel"));
    assert.ok(!account.includes("ACCOUNT_SECTION_ROLE_REGISTRATION"));
    assert.ok(!account.includes("ACCOUNT_GUEST_"));
    assert.ok(!account.includes("일반 사용자로 등록"));
    assert.ok(!account.includes("saveConsumerProfile"));
  });

  it("shows login CTA without Ops Token UI", () => {
    const account = readSource("src/components/AccountPageClient.tsx");
    assert.ok(account.includes("로그인"));
    assert.ok(account.includes("ROUTES.login"));
    assert.ok(!/Ops Token/i.test(account));
    assert.ok(!account.includes("부트스트랩"));
    assert.ok(!account.includes("AdminRoleVerifier"));
    assert.ok(!account.includes("account-role-admin"));
  });

  it("wraps admin routes with account-based access gate", () => {
    const layout = readSource("src/app/(store)/admin/layout.tsx");
    const gate = readSource("src/components/AdminAccessGate.tsx");
    assert.ok(layout.includes("AdminAccessGate"));
    assert.ok(gate.includes("ADMIN_ACCESS_REQUIRED_TITLE"));
    assert.ok(gate.includes("ROUTES.login"));
    assert.ok(gate.includes("isAdminAccountRole"));
    assert.ok(gate.includes("useStoreLogout"));
    assert.ok(!gate.includes("confirmAdminSession"));
    assert.ok(!gate.includes("admin-ops-session"));
  });

  it("does not link admin or account menus to KU drafts panel", () => {
    const account = readSource("src/components/AccountPageClient.tsx");
    const adminPage = readSource("src/app/(store)/admin/knowledge-unit-drafts/page.tsx");
    assert.ok(!account.includes("AdminKnowledgeUnitDraftReviewPanel"));
    assert.ok(!account.includes("knowledge-unit-drafts"));
    assert.ok(adminPage.includes("내부 지식 생성 기능 종료"));
    assert.ok(!adminPage.includes("AdminKnowledgeUnitDraftReviewPanel"));
  });
});
