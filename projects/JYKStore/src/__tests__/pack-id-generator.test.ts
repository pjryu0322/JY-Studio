import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PACK_ID_PATTERN,
  createPackIdFallback,
  generateUniquePackId,
  slugifyPackName,
} from "../lib/pack-id-generator.ts";

describe("slugifyPackName", () => {
  it("slugifies latin product names", () => {
    assert.equal(slugifyPackName("TOAST UI Grid"), "toast-ui-grid");
    assert.equal(slugifyPackName("Naver Maps API"), "naver-maps-api");
  });

  it("removes special characters", () => {
    assert.equal(slugifyPackName("Hello @ World!"), "hello-world");
  });

  it("returns empty slug for korean-only names", () => {
    assert.equal(slugifyPackName("카카오 인증"), "");
  });

  it("truncates slugs longer than 60 characters", () => {
    const longName = "a".repeat(80);
    const slug = slugifyPackName(longName);
    assert.ok(slug.length <= 60);
    assert.ok(PACK_ID_PATTERN.test(slug));
  });
});

describe("createPackIdFallback", () => {
  it("matches pack-YYYYMMDD-xxxx pattern", () => {
    const id = createPackIdFallback();
    assert.match(id, /^pack-\d{8}-[a-f0-9]{4}$/);
    assert.ok(PACK_ID_PATTERN.test(id));
  });
});

describe("generateUniquePackId", () => {
  it("uses slug when available and unique", async () => {
    const id = await generateUniquePackId("TOAST UI Grid", async () => false);
    assert.equal(id, "toast-ui-grid");
  });

  it("uses fallback when slug is too short", async () => {
    const id = await generateUniquePackId("카카오", async () => false);
    assert.match(id, /^pack-\d{8}-[a-f0-9]{4}$/);
  });

  it("appends numeric suffix on collision", async () => {
    const taken = new Set(["toast-ui-grid"]);
    const id = await generateUniquePackId("TOAST UI Grid", async (packId) => taken.has(packId));
    assert.equal(id, "toast-ui-grid-2");
  });

  it("increments suffix when multiple collisions occur", async () => {
    const taken = new Set(["toast-ui-grid", "toast-ui-grid-2"]);
    const id = await generateUniquePackId("TOAST UI Grid", async (packId) => taken.has(packId));
    assert.equal(id, "toast-ui-grid-3");
  });
});
