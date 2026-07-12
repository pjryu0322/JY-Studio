import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDefaultProviderPackTab,
  resolveProviderPackTabFromLocation,
} from "../lib/provider-pack-tabs.ts";

describe("resolveDefaultProviderPackTab", () => {
  it("opens basic tab after create when no documents", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: true,
        status: "DRAFT",
        sourceDocumentCount: 0,
      }),
      "basic",
    );
  });

  it("opens materials tab when DRAFT has no sources", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 0,
      }),
      "materials",
    );
  });

  it("opens review tab when DRAFT has sources or is reviewing", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 2,
      }),
      "review",
    );
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "REVIEWING",
        sourceDocumentCount: 1,
      }),
      "review",
    );
  });
});

describe("resolveProviderPackTabFromLocation", () => {
  it("maps legacy hash anchors and tabs to freeze-era tabs", () => {
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#github-auto-collect",
        fallback: "basic",
      }),
      "materials",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#pack-inspection",
        fallback: "basic",
      }),
      "review",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#pack-review",
        fallback: "basic",
      }),
      "review",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "source",
        hash: "",
        fallback: "basic",
      }),
      "materials",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "draft",
        hash: "",
        fallback: "basic",
      }),
      "materials",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "inspection",
        hash: "",
        fallback: "basic",
      }),
      "review",
    );
  });

  it("prefers current tab query over hash", () => {
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "materials",
        hash: "#pack-review",
        fallback: "basic",
      }),
      "materials",
    );
  });
});
