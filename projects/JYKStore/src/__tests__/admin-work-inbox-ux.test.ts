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

describe("admin work inbox UX", () => {
  it("lands admins on the work inbox home", () => {
    assert.equal(postAuthLandingPath("ADMIN"), ROUTES.admin);
    assert.ok(readSource("src/app/(store)/admin/page.tsx").includes("AdminWorkInboxPageClient"));
  });

  it("orders admin work by accept, generate, provider review, pack review, returned", () => {
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_ACCEPT_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_GENERATE_TITLE"));
    assert.ok(!inbox.includes("ADMIN_WORK_SECTION_QUALITY_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE"));
    assert.ok(inbox.includes("partitionAdminReviewRequiredByServicePhase"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_SERVICE_VALIDATION_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_PACK_REVIEW_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_SECTION_RETURNED_TITLE"));
    assert.ok(inbox.includes("PROVIDER_SUPPLEMENT_REQUIRED") || inbox.includes("returnedItems"));
    assert.ok(inbox.includes("returnedItems"));
    assert.ok(inbox.includes("buildAdminWorkInboxItemViewModel"));
    assert.ok(inbox.includes("countAdminWorkInboxWaiting"));
    assert.ok(!inbox.includes("생성 완료"));
    assert.ok(!inbox.includes('phase === "COMPLETED"'));
    assert.ok(inbox.includes("step=queue"));
    assert.ok(inbox.includes("step=generation"));
    assert.ok(inbox.includes("step=providerConfirm"));
    assert.ok(inbox.includes("step=searchValidation"));
    assert.ok(inbox.includes("step=decision"));
    assert.ok(inbox.includes("adminWorkInboxDetailHref"));
    const acceptAt = inbox.indexOf("title={ADMIN_WORK_SECTION_ACCEPT_TITLE}");
    const generateAt = inbox.indexOf("title={ADMIN_WORK_SECTION_GENERATE_TITLE}");
    const providerAt = inbox.indexOf("title={ADMIN_WORK_SECTION_PROVIDER_REVIEW_TITLE}");
    const serviceAt = inbox.indexOf("title={ADMIN_WORK_SECTION_SERVICE_VALIDATION_TITLE}");
    const packAt = inbox.indexOf("title={ADMIN_WORK_SECTION_PACK_REVIEW_TITLE}");
    const returnedAt = inbox.indexOf("title={ADMIN_WORK_SECTION_RETURNED_TITLE}");
    assert.ok(acceptAt > 0 && acceptAt < generateAt);
    assert.ok(generateAt < providerAt);
    assert.ok(providerAt < serviceAt);
    assert.ok(serviceAt < packAt);
    assert.ok(packAt < returnedAt);
  });

  it("puts 지식데이터 접수 first in the admin console rail", () => {
    const rail = readSource("src/lib/role-workspace/admin-review-rail.ts");
    assert.ok(rail.includes('label: "지식데이터 접수"'));
    assert.ok(!rail.includes('label: "할 일"'));
    assert.ok(!rail.includes('label: "오늘 처리할 일"'));
    const consoleRail = rail.slice(rail.indexOf("getAdminConsoleRailItems"));
    assert.ok(consoleRail.indexOf('id: "home"') < consoleRail.indexOf('id: "generation"'));
    assert.ok(consoleRail.indexOf('id: "generation"') < consoleRail.indexOf('id: "quality"'));
    assert.ok(consoleRail.indexOf('id: "quality"') < consoleRail.indexOf('id: "correction"'));
  });

  it("exposes an admin 지식데이터 접수 Inbox icon on the app left rail", () => {
    const routes = readSource("src/lib/routes.ts");
    const nav = readSource("src/components/BottomTabNav.tsx");
    assert.ok(routes.includes('"admin"'));
    assert.ok(routes.includes('label: "지식데이터 접수"'));
    assert.ok(!routes.includes('label: "할 일"'));
    assert.ok(nav.includes('"admin"'));
    assert.ok(nav.includes('"categories"') || nav.includes('"adminAccept"'));
    assert.ok(nav.includes('case "admin":'));
    // Inbox silhouette (not checklist / home)
    assert.ok(nav.includes("M22 12h-6l-2 3h-4l-2-3H2"));
    assert.ok(nav.includes("aria-label=") || nav.includes("title="));
  });

  it("exposes admin-only stage rails for 생성 / 점검 / 보정 queues", () => {
    const routes = readSource("src/lib/routes.ts");
    const nav = readSource("src/components/BottomTabNav.tsx");
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    const rail = readSource("src/lib/role-workspace/admin-review-rail.ts");
    assert.ok(routes.includes("adminQueuePath"));
    assert.ok(routes.includes('queue=${encodeURIComponent(queue)}') || routes.includes("queue="));
    assert.ok(routes.includes('label: "지식데이터 생성"'));
    assert.ok(routes.includes('label: "점검"'));
    assert.ok(routes.includes('label: "보정"'));
    assert.ok(!routes.includes('label: "생성·품질보정"'));
    assert.ok(nav.includes('"adminGeneration"'));
    assert.ok(nav.includes('"adminQuality"'));
    assert.ok(nav.includes('"adminCorrection"'));
    const adminOrder = nav.slice(
      nav.indexOf('role === "ADMIN"'),
      nav.indexOf('role === "PROVIDER"'),
    );
    assert.ok(adminOrder.includes('"adminGeneration"'));
    assert.ok(adminOrder.includes('"adminQuality"'));
    assert.ok(adminOrder.includes('"adminCorrection"'));
    assert.ok(inbox.includes("filterAdminWorkQueue"));
    assert.ok(inbox.includes("parseAdminWorkQueue"));
    assert.ok(inbox.includes("WorkInboxTable") || inbox.includes("접수요청일"));
    assert.ok(inbox.includes("접수일"));
    assert.ok(!inbox.includes("접수일자"));
    assert.ok(inbox.includes("품질점검일"));
    assert.ok(inbox.includes("품질점검상태"));
    assert.ok(inbox.includes("ADMIN_WORK_GENERATION_TARGETS_TITLE"));
    assert.ok(inbox.includes("ADMIN_WORK_QUALITY_TARGETS_TITLE"));
    assert.ok(inbox.includes("formatInboxDate"));
    assert.ok(inbox.includes("현재상태"));
    assert.ok(inbox.includes("QualityCheckIcon"));
    assert.ok(inbox.includes("selectedQualityPackId"));
    assert.ok(inbox.includes(">번호<") || inbox.includes('"번호"') || inbox.includes("번호"));
    assert.ok(inbox.includes("sortWorkInboxItems") || inbox.includes("SortableHeader"));
    assert.ok(inbox.includes("AdminKnowledgeGenerationPanel"));
    assert.ok(inbox.includes("workbenchMode=\"generation\"") || inbox.includes('workbenchMode="generation"'));
    assert.ok(inbox.includes('workbenchMode="quality"') || inbox.includes("workbenchMode=\"quality\""));
    assert.ok(!inbox.includes(">닫기<"));
    const genCard = readSource("src/components/AdminWorkerZipGenerationCard.tsx");
    assert.ok(!genCard.includes("접수된 ZIP으로 지식데이터를 생성합니다."));
    assert.ok(!genCard.includes("점검으로 이동"));
    assert.ok(genCard.includes("generationCollapsed"));
    assert.ok(genCard.includes("qualityCollapsed"));
    assert.ok(genCard.includes("품질점검"));
    assert.ok(genCard.includes("완료취소"));
    assert.ok(genCard.includes('{qualityRefreshing ? "실행 중…" : "실행"}'));
    assert.ok(genCard.includes("embedded"));
    assert.ok(rail.includes('label: "생성"'));
    assert.ok(rail.includes('label: "점검"'));
    assert.ok(rail.includes('label: "보정"'));
    assert.ok(inbox.includes("AdminCorrectionQueuePanel"));
    assert.ok(inbox.includes("조치하기"));
    assert.ok(inbox.includes("selectedCorrectionPack"));
    assert.ok(inbox.includes("filterAdminCorrectionQueue"));
    const copy = readSource("src/lib/role-based-ux-copy.ts");
    assert.ok(copy.includes('ADMIN_CORRECTION_QUEUE_TITLE = "지식데이터 보정"'));
  });

  it("removes nested console rail and restores inbox chrome title", () => {
    const workspace = readSource("src/components/role-workspace/AdminConsoleWorkspace.tsx");
    const inbox = readSource("src/components/AdminWorkInboxPageClient.tsx");
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const chrome = readSource("src/lib/store-page-chrome.ts");
    assert.ok(!workspace.includes("RoleWorkspaceShell"));
    assert.ok(!workspace.includes("getAdminConsoleRailItems"));
    assert.ok(!detail.includes("RoleWorkspaceShell"));
    assert.ok(!inbox.includes("ADMIN_WORK_INBOX_TITLE"));
    assert.ok(chrome.includes("ADMIN_WORK_INBOX_TITLE"));
    assert.ok(chrome.includes("ADMIN_WORK_INBOX_DESCRIPTION"));
    assert.ok(inbox.includes("admin-work-category"));
    assert.ok(inbox.includes("admin-work-status"));
  });

  it("filters reviewing packs to open review statuses only", () => {
    const service = readSource("src/lib/admin-review-service.ts");
    assert.ok(service.includes("isOpenPackReviewStatus"));
    assert.ok(service.includes('item.status === "PUBLISHED"'));
  });
});
