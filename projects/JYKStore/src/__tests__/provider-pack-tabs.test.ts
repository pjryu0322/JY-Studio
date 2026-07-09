import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDefaultProviderPackTab,
  resolveProviderPackTabFromLocation,
} from "../lib/provider-pack-tabs.ts";

describe("resolveDefaultProviderPackTab", () => {
  it("opens source tab after create when no documents", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: true,
        status: "DRAFT",
        sourceDocumentCount: 0,
        knowledgeUnitDraftCount: 0,
      }),
      "source",
    );
  });

  it("opens draft tab when sources exist without drafts", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 2,
        knowledgeUnitDraftCount: 0,
      }),
      "draft",
    );
  });

  it("opens review tab when drafts exist or pack is reviewing", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 2,
        knowledgeUnitDraftCount: 3,
      }),
      "review",
    );
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "REVIEWING",
        sourceDocumentCount: 1,
        knowledgeUnitDraftCount: 1,
      }),
      "review",
    );
  });
});

describe("resolveProviderPackTabFromLocation", () => {
  it("maps legacy hash anchors to tabs", () => {
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#github-auto-collect",
        fallback: "basic",
      }),
      "source",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#pack-review",
        fallback: "basic",
      }),
      "review",
    );
  });

  it("prefers tab query over hash", () => {
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "draft",
        hash: "#pack-review",
        fallback: "basic",
      }),
      "draft",
    );
  });
});
