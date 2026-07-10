import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { requireAdminSession } from "../../src/lib/admin-route-guard.ts";

describe("admin account auth guard", () => {
  it("rejects requests without a store auth session", async () => {
    const request = new NextRequest("http://localhost/api/v1/admin/reviews");
    const result = await requireAdminSession(request, "client-1");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.code, "ADMIN_AUTH_REQUIRED");
      assert.ok(result.message.includes("관리자"));
    }
  });
});
