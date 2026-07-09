import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { ADMIN_OPS_TOKEN_HEADER } from "@/lib/admin-auth";
import { GET as listDraftsGET } from "@/app/api/v1/admin/knowledge-unit-drafts/route";
import { POST as decideDraftPOST } from "@/app/api/v1/admin/knowledge-unit-drafts/[draftId]/decision/route";

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

function adminRequestHeaders(token: string): Record<string, string> {
  return {
    [ADMIN_OPS_TOKEN_HEADER]: token,
    "Content-Type": "application/json",
  };
}

describe("admin knowledge unit draft route contract", () => {
  it("GET route calls guard before list service", () => {
    const source = readRoute(listRoutePath);
    assert.ok(source.includes('from "@/lib/admin-route-guard"'));
    assert.ok(source.includes("rejectUnlessAdminOps(request, clientId)"));
    const guardAt = source.indexOf("rejectUnlessAdminOps(request, clientId)");
    const listAt = source.indexOf("listAdminKnowledgeUnitDrafts(");
    assert.ok(guardAt >= 0 && listAt > guardAt);
  });

  it("POST decision route calls guard before decide service", () => {
    const source = readRoute(decisionRoutePath);
    assert.ok(source.includes("rejectUnlessAdminOps(request, clientId)"));
    const guardAt = source.indexOf("rejectUnlessAdminOps(request, clientId)");
    const decideAt = source.indexOf("decideAdminKnowledgeUnitDraft(");
    assert.ok(guardAt >= 0 && decideAt > guardAt);
  });

  it("POST decision route maps AdminKnowledgeUnitDraftError status", () => {
    const source = readRoute(decisionRoutePath);
    assert.ok(source.includes("error instanceof AdminKnowledgeUnitDraftError"));
    assert.ok(source.includes("status: error.status"));
  });
});

describe("admin knowledge unit draft route handlers", () => {
  const previousToken = process.env.JYKSTORE_ADMIN_OPS_TOKEN;
  const token = "p26-9-1-test-admin-token";

  before(() => {
    process.env.JYKSTORE_ADMIN_OPS_TOKEN = token;
  });

  after(() => {
    if (previousToken === undefined) {
      delete process.env.JYKSTORE_ADMIN_OPS_TOKEN;
    } else {
      process.env.JYKSTORE_ADMIN_OPS_TOKEN = previousToken;
    }
  });

  it("GET /admin/knowledge-unit-drafts rejects non-admin before service call", async () => {
    const request = new NextRequest("http://localhost/api/v1/admin/knowledge-unit-drafts");
    const response = await listDraftsGET(request);

    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "ADMIN_AUTH_REQUIRED");
  });

  it("POST /admin/knowledge-unit-drafts/[draftId]/decision rejects non-admin before service call", async () => {
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

  it("POST decision returns 400 VALIDATION for invalid JSON", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/admin/knowledge-unit-drafts/draft-1/decision",
      {
        method: "POST",
        headers: adminRequestHeaders(token),
        body: "{not-valid-json",
      },
    );

    const response = await decideDraftPOST(request, {
      params: Promise.resolve({ draftId: "draft-1" }),
    });

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.equal(body.error, "VALIDATION");
  });
});
