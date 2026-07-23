import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCategoryId } from "../lib/admin-category-service.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin category hierarchy", () => {
  it("validates categoryId slug rules", () => {
    assert.equal(validateCategoryId(""), "CATEGORY_ID_REQUIRED");
    assert.equal(validateCategoryId("Auth SSO"), "CATEGORY_ID_INVALID");
    assert.equal(validateCategoryId("auth_sso"), "CATEGORY_ID_INVALID");
    assert.equal(validateCategoryId("auth-sso"), null);
    assert.equal(validateCategoryId("Auth"), null); // normalized to lowercase
    assert.equal(validateCategoryId("api"), null);
  });

  it("wires admin category CRUD API and manager UI", () => {
    const schema = readSource("prisma/schema.prisma");
    const page = readSource("src/app/(store)/categories/page.tsx");
    const manager = readSource("src/components/AdminCategoryManager.tsx");
    const route = readSource("src/app/api/v1/admin/categories/route.ts");
    const itemRoute = readSource("src/app/api/v1/admin/categories/[categoryId]/route.ts");

    assert.ok(schema.includes("parentCategoryId"));
    assert.ok(schema.includes("CategoryHierarchy"));
    const mock = readSource("src/data/mock-categories.ts");
    assert.ok(mock.includes('name: "정보화지식"'));
    assert.ok(mock.includes("ROOT_INFORMATIZATION_CATEGORY_ID"));
    assert.ok(mock.includes('parentCategoryId: ROOT_INFORMATIZATION_CATEGORY_ID'));
    assert.ok(page.includes("AdminCategoryManager"));
    assert.ok(page.includes("isAdminAccountRole"));
    assert.ok(manager.includes("하위 추가"));
    assert.ok(manager.includes("상위 카테고리 추가"));
    assert.ok(route.includes("createAdminCategory"));
    assert.ok(itemRoute.includes("updateAdminCategory"));
    assert.ok(itemRoute.includes("deleteAdminCategory"));
  });
});
