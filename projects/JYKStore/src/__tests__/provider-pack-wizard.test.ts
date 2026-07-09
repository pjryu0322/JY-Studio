import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveProviderPackWizardStep } from "../lib/provider-pack-wizard.ts";

describe("resolveProviderPackWizardStep", () => {
  it("routes DRAFT with no sources to source step", () => {
    assert.equal(
      resolveProviderPackWizardStep({
        status: "DRAFT",
        sourceDocumentCount: 0,
        knowledgeUnitDraftCount: 0,
      }),
      "source",
    );
  });

  it("forces source step when created banner and no sources", () => {
    assert.equal(
      resolveProviderPackWizardStep({
        status: "DRAFT",
        sourceDocumentCount: 0,
        knowledgeUnitDraftCount: 0,
        forceSourceStep: true,
      }),
      "source",
    );
  });

  it("routes to draft-generation when sources exist but no drafts", () => {
    assert.equal(
      resolveProviderPackWizardStep({
        status: "DRAFT",
        sourceDocumentCount: 3,
        knowledgeUnitDraftCount: 0,
      }),
      "draft-generation",
    );
  });

  it("routes to review when drafts exist", () => {
    assert.equal(
      resolveProviderPackWizardStep({
        status: "DRAFT",
        sourceDocumentCount: 2,
        knowledgeUnitDraftCount: 5,
      }),
      "review",
    );
  });

  it("routes REVIEWING to readonly-reviewing", () => {
    assert.equal(
      resolveProviderPackWizardStep({
        status: "REVIEWING",
        sourceDocumentCount: 1,
        knowledgeUnitDraftCount: 1,
      }),
      "readonly-reviewing",
    );
  });

  it("routes PUBLISHED to readonly-published", () => {
    assert.equal(
      resolveProviderPackWizardStep({
        status: "PUBLISHED",
        sourceDocumentCount: 1,
        knowledgeUnitDraftCount: 1,
      }),
      "readonly-published",
    );
  });
});
