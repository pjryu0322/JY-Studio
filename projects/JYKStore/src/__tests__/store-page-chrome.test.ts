import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStorePageChrome } from "../lib/store-page-chrome.ts";
import { ROUTES } from "../lib/routes.ts";

describe("resolveStorePageChrome", () => {
  it("returns title and description for major store routes", () => {
    assert.equal(resolveStorePageChrome(ROUTES.provider).title, "지식팩 제공자 센터");
    assert.equal(resolveStorePageChrome(ROUTES.accountProfile).title, "프로필 관리");
    assert.equal(resolveStorePageChrome(ROUTES.packs).title, "지식팩 둘러보기");
    assert.equal(resolveStorePageChrome(ROUTES.adminReviews).title.includes("관리자"), true);
    assert.equal(resolveStorePageChrome(`${ROUTES.adminReviews}/pack-1`).title, "지식데이터 생성 및 편집");
    assert.equal(resolveStorePageChrome(ROUTES.adminGeneration).title, "지식데이터 생성");
    assert.equal(resolveStorePageChrome(ROUTES.admin, "queue=receipt").title, "자료 접수");
    assert.equal(resolveStorePageChrome(ROUTES.admin, "queue=accept").title, "자료 접수");
    assert.equal(
      resolveStorePageChrome(ROUTES.admin, "queue=generation").title,
      "지식데이터 생성",
    );
  });

  it("never returns empty chrome", () => {
    const chrome = resolveStorePageChrome("/unknown-path");
    assert.ok(chrome.title.length > 0);
    assert.ok(chrome.description.length > 0);
  });
});
