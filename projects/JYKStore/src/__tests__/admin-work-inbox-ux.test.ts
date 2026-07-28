import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { postAuthLandingPath } from "../lib/account-role.ts";
import { ROUTES } from "../lib/routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin work inbox UX (P2)", () => {
  it("lands admins on the work inbox home", () => {
    assert.equal(postAuthLandingPath("ADMIN"), ROUTES.admin);
    assert.ok(readSource("src/app/(store)/admin/page.tsx").includes("AdminWorkInboxPageClient"));
  });

  it("deep-links detail steps to P2 workflow ids", () => {
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    assert.ok(inbox.includes("step=receipt"));
    assert.ok(inbox.includes("step=knowledgeScope"));
    assert.ok(inbox.includes("step=serviceValidation"));
    assert.ok(inbox.includes("step=publish"));
    assert.ok(!inbox.includes("step=providerConfirm"));
    assert.ok(!inbox.includes("step=searchValidation"));
    assert.ok(!inbox.includes("step=decision"));
    assert.ok(!inbox.includes("step=queue"));
    assert.ok(inbox.includes("adminWorkInboxDetailHref"));
    assert.ok(inbox.includes("filterAdminWorkQueue"));
    assert.ok(inbox.includes("parseAdminWorkQueue"));
  });

  it("puts 자료 접수 first in the admin console rail", () => {
    const rail = readSource("src/lib/role-workspace/admin-review-rail.ts");
    assert.ok(rail.includes("ADMIN_WORKFLOW_STEP_LABELS.receipt"));
    assert.ok(rail.includes("ADMIN_WORKFLOW_STEP_LABELS.knowledgeScope"));
    assert.ok(rail.includes("ADMIN_WORKFLOW_STEP_LABELS.publish"));
    assert.ok(!rail.includes('label: "점검"'));
    assert.ok(!rail.includes('label: "제공자 검토"'));
    const consoleRail = rail.slice(rail.indexOf("getAdminConsoleRailItems"));
    assert.ok(consoleRail.indexOf('id: "receipt"') < consoleRail.indexOf('id: "generation"'));
    assert.ok(consoleRail.indexOf('id: "generation"') < consoleRail.indexOf('id: "correction"'));
    assert.ok(!consoleRail.includes('id: "quality"'));
  });

  it("exposes admin-only stage rails for P2 queues", () => {
    const routes = readSource("src/lib/routes.ts");
    const nav = readSource("src/components/BottomTabNav.tsx");
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    assert.ok(routes.includes("adminQueuePath"));
    assert.ok(routes.includes('label: "자료 접수"'));
    assert.ok(routes.includes('label: "지식화 대상 확인"'));
    assert.ok(routes.includes('label: "지식데이터 생성"'));
    assert.ok(routes.includes('label: "보정"'));
    assert.ok(routes.includes('label: "서비스 검증"'));
    assert.ok(routes.includes('label: "게시"'));
    assert.ok(!routes.includes('label: "점검"'));
    assert.ok(nav.includes('"adminGeneration"'));
    assert.ok(nav.includes('"adminKnowledgeScope"'));
    assert.ok(nav.includes('"adminCorrection"'));
    assert.ok(nav.includes('"adminPublish"'));
    assert.ok(!nav.includes('"adminQuality"'));
    const adminOrder = nav.slice(
      nav.indexOf('role === "ADMIN"'),
      nav.indexOf('role === "PROVIDER"'),
    );
    assert.ok(adminOrder.includes('"adminGeneration"'));
    assert.ok(adminOrder.includes('"adminCorrection"'));
    assert.ok(adminOrder.includes('"adminPublish"'));
    assert.ok(inbox.includes("AdminKnowledgeGenerationPanel"));
  });
});
