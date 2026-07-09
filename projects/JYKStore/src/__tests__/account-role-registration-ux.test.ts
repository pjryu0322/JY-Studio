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
  it("gates guest from API Key menu until consumer registration", () => {
    const account = readSource("src/components/AccountPageClient.tsx");
    assert.ok(account.includes("역할 계정 등록"));
    assert.ok(account.includes("일반 사용자로 등록"));
    assert.ok(account.includes("API Key 관리"));
    assert.ok(account.includes("saveConsumerProfile"));
    assert.ok(!account.includes("운영 사용량 확인") || account.includes("adminVerified"));
    assert.ok(account.includes("AdminRoleVerifier"));
  });

  it("wraps admin routes with access gate", () => {
    const layout = readSource("src/app/(store)/admin/layout.tsx");
    const gate = readSource("src/components/AdminAccessGate.tsx");
    assert.ok(layout.includes("AdminAccessGate"));
    assert.ok(gate.includes("운영자 권한이 필요합니다"));
    assert.ok(gate.includes("account-role-admin"));
  });

  it("exposes admin ops verify route", () => {
    const route = readSource("src/app/api/v1/admin/ops/verify/route.ts");
    assert.ok(route.includes("verifyAdminOpsRequest"));
  });
});
