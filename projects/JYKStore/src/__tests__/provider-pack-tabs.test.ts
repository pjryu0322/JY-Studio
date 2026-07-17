import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDefaultProviderPackTab,
  resolveProviderPackTabFromLocation,
  resolveProviderPackTabLocks,
  PROVIDER_PACK_TAB_IDS,
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

  it("opens payload tab when DRAFT has no payload/sources", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 0,
      }),
      "payload",
    );
  });

  it("opens payload when payload exists but provider has not confirmed", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 0,
        hasPayload: true,
        providerConfirmed: false,
        knowledgePassed: false,
        hasDistribution: false,
      }),
      "payload",
    );
  });

  it("opens knowledge after confirm before pipeline pass", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 0,
        hasPayload: true,
        providerConfirmed: true,
        knowledgePassed: false,
        hasDistribution: false,
      }),
      "knowledge",
    );
  });

  it("opens serviceValidation when knowledge passed without search validation", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 0,
        hasPayload: true,
        providerConfirmed: true,
        knowledgePassed: true,
        hasDistribution: false,
        serviceValidationPassed: false,
      }),
      "serviceValidation",
    );
  });

  it("opens distributionReview when search validation is complete", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 2,
        hasPayload: true,
        providerConfirmed: true,
        knowledgePassed: true,
        hasDistribution: true,
        serviceValidationPassed: true,
      }),
      "distributionReview",
    );
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "REVIEWING",
        sourceDocumentCount: 1,
      }),
      "distributionReview",
    );
  });
});

describe("resolveProviderPackTabFromLocation", () => {
  it("maps legacy hash anchors and tabs to the 5-step workflow", () => {
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#github-auto-collect",
        fallback: "basic",
      }),
      "payload",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#pack-inspection",
        fallback: "basic",
      }),
      "distributionReview",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: null,
        hash: "#pack-review",
        fallback: "basic",
      }),
      "distributionReview",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "source",
        hash: "",
        fallback: "basic",
      }),
      "payload",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "materials",
        hash: "",
        fallback: "basic",
      }),
      "payload",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "draft",
        hash: "",
        fallback: "basic",
      }),
      "payload",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "inspection",
        hash: "",
        fallback: "basic",
      }),
      "distributionReview",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "distribution",
        hash: "",
        fallback: "basic",
      }),
      "distributionReview",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "review",
        hash: "",
        fallback: "basic",
      }),
      "distributionReview",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "search-validation",
        hash: "",
        fallback: "basic",
      }),
      "serviceValidation",
    );
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "data-structure",
        hash: "",
        fallback: "basic",
      }),
      "knowledge",
    );
  });

  it("prefers current tab query over hash", () => {
    assert.equal(
      resolveProviderPackTabFromLocation({
        tabParam: "payload",
        hash: "#pack-review",
        fallback: "basic",
      }),
      "payload",
    );
  });
});

describe("resolveProviderPackTabLocks", () => {
  it("unlocks search validation after structure and distribution after search validation", () => {
    const locked = resolveProviderPackTabLocks({
      providerConfirmed: true,
      knowledgePassed: true,
      distributionReady: false,
      serviceValidationPassed: false,
    });
    assert.equal(locked.serviceValidation.locked, false);
    assert.equal(locked.distributionReview.locked, true);

    const unlocked = resolveProviderPackTabLocks({
      providerConfirmed: true,
      knowledgePassed: true,
      distributionReady: true,
      serviceValidationPassed: true,
    });
    assert.equal(unlocked.distributionReview.locked, false);
  });
});

describe("PROVIDER_PACK_TAB_IDS", () => {
  it("defines the 5-step registration order", () => {
    assert.deepEqual([...PROVIDER_PACK_TAB_IDS], [
      "basic",
      "payload",
      "knowledge",
      "serviceValidation",
      "distributionReview",
    ]);
  });
});
