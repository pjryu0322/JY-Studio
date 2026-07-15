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

  it("opens distribution when knowledge passed without distribution metadata", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 0,
        hasPayload: true,
        providerConfirmed: true,
        knowledgePassed: true,
        hasDistribution: false,
      }),
      "distribution",
    );
  });

  it("opens serviceValidation when distribution ready but validation incomplete", () => {
    assert.equal(
      resolveDefaultProviderPackTab({
        created: false,
        status: "DRAFT",
        sourceDocumentCount: 2,
        hasPayload: true,
        providerConfirmed: true,
        knowledgePassed: true,
        hasDistribution: true,
        serviceValidationPassed: false,
      }),
      "serviceValidation",
    );
  });

  it("opens review tab when ready or reviewing", () => {
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
  it("maps legacy hash anchors and tabs to distribution tabs", () => {
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
      "review",
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
