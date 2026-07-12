import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { GET as listDraftsGET } from "@/app/api/v1/admin/knowledge-unit-drafts/route";
import { POST as decideDraftPOST } from "@/app/api/v1/admin/knowledge-unit-drafts/[draftId]/decision/route";
import { LEGACY_BUILDER_DISABLED_ERROR } from "@/lib/legacy-builder-disabled";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

const listRoutePath = join(projectRoot, "src/app/api/v1/admin/knowledge-unit-drafts/route.ts");
const decisionRoutePath = join(
  projectRoot,
  "src/app/api/v1/admin/knowledge-unit-drafts/[draftId]/decision/route.ts",
);

function readRoute(path: string): string {
  return readFileSync(path, "utf8");
}

describe("admin knowledge unit draft route contract", () => {
  it("GET route calls guard before list service", () => {
    const source = readRoute(listRoutePath);
    assert.ok(source.includes('from "@/lib/admin-route-guard"'));
    assert.ok(source.includes("rejectUnlessAdmin(request, clientId)"));
    const guardAt = source.indexOf("rejectUnlessAdmin(request, clientId)");
    const listAt = source.indexOf("listAdminKnowledgeUnitDrafts(");
    assert.ok(guardAt >= 0 && listAt > guardAt);
  });

  it("POST decision route freezes Builder with 410 after admin guard", () => {
    const source = readRoute(decisionRoutePath);
    assert.ok(source.includes("requireAdminSession"));
    assert.ok(source.includes("legacyBuilderDisabledBody"));
    assert.ok(source.includes("status: 410"));
    assert.ok(!source.includes("decideAdminKnowledgeUnitDraft("));
    assert.ok(!source.includes("AdminKnowledgeUnitDraftError"));
  });
});

describe("admin knowledge unit draft route handlers", () => {
  it("GET /admin/knowledge-unit-drafts rejects non-admin before service call", async () => {
    const request = new NextRequest("http://localhost/api/v1/admin/knowledge-unit-drafts");
    const response = await listDraftsGET(request);

    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "ADMIN_AUTH_REQUIRED");
  });

  it("POST /admin/knowledge-unit-drafts/[draftId]/decision rejects non-admin before freeze", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/admin/knowledge-unit-drafts/draft-1/decision",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      },
    );

    const response = await decideDraftPOST(request, {
      params: Promise.resolve({ draftId: "draft-1" }),
    });

    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "ADMIN_AUTH_REQUIRED");
  });

  it("POST decision rejects unauthenticated invalid JSON before body parse", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/admin/knowledge-unit-drafts/draft-1/decision",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-valid-json",
      },
    );

    const response = await decideDraftPOST(request, {
      params: Promise.resolve({ draftId: "draft-1" }),
    });

    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "ADMIN_AUTH_REQUIRED");
  });

  it("exposes LEGACY_BUILDER_DISABLED error code for freeze responses", () => {
    assert.equal(LEGACY_BUILDER_DISABLED_ERROR, "LEGACY_BUILDER_DISABLED");
    const source = readRoute(decisionRoutePath);
    assert.ok(source.includes("legacyBuilderDisabledBody"));
  });
});
