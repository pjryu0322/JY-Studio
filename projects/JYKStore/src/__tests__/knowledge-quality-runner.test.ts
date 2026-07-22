import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runKnowledgeQuality } from "@/lib/structure-quality/knowledge-quality-runner";
import type { StructureCoverageRunResult } from "@/lib/structure-quality/structure-quality-types";
import { runStructureCoverage } from "@/lib/structure-quality/structure-coverage-runner";
import { getStructureTemplateDefinition, STRUCTURE_TEMPLATE_KEYS } from "@/lib/structure-quality/structure-template-definitions";

function fakeCoverage(status: "PASS" | "WARNING" | "FAIL"): StructureCoverageRunResult {
  return {
    templateKey: STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT,
    status,
    coverageScore: status === "FAIL" ? 50 : 95,
    requiredSectionCount: 8,
    coveredRequiredCount: status === "FAIL" ? 4 : 8,
    missingRequiredCount: status === "FAIL" ? 4 : 0,
    optionalSectionCount: 2,
    coveredOptionalCount: 0,
    summary: `coverage ${status}`,
    items: [],
  };
}

function minimalCoverage(status: "PASS" | "WARNING" | "FAIL") {
  const def = getStructureTemplateDefinition(STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT)!;
  const sections = def.sections.map((s) => ({
    sectionKey: s.sectionKey,
    title: s.title,
    required: s.required,
    weight: s.weight,
    sourceTypes: s.sourceTypes,
    keywords: s.keywords,
  }));
  return runStructureCoverage({
    templateKey: STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT,
    sections,
    documents:
      status === "FAIL"
        ? []
        : [
            {
              id: "d1",
              sourceType: "PRODUCT_MANUAL",
              title: "overview product 개요",
              content: "product overview 개요 소개 feature 기능",
              sourceUrl: null,
              validationStatus: "PASS",
              productVersion: "1.0",
            },
          ],
  });
}

describe("knowledge quality runner", () => {
  it("fails when source validation FAIL exists", () => {
    const structureCoverage = fakeCoverage("PASS");
    const result = runKnowledgeQuality({
      structureCoverage,
      documents: [
        {
          id: "d1",
          sourceType: "PRODUCT_MANUAL",
          title: "doc",
          content: "content long enough for usability checks here",
          sourceUrl: null,
          validationStatus: "FAIL",
        },
      ],
    });
    assert.equal(result.status, "FAIL");
  });

  it("fails when structure coverage FAIL", () => {
    const structureCoverage = minimalCoverage("FAIL");
    const result = runKnowledgeQuality({
      structureCoverage,
      documents: [],
    });
    assert.equal(result.status, "FAIL");
  });

  it("warns when only source validation WARNING", () => {
    const structureCoverage = fakeCoverage("PASS");
    const result = runKnowledgeQuality({
      structureCoverage,
      documents: [
        {
          id: "d1",
          sourceType: "PRODUCT_MANUAL",
          title: "overview product",
          content: "product overview 개요 feature 기능 install setup",
          sourceUrl: null,
          validationStatus: "WARNING",
          productVersion: "1.0",
        },
      ],
    });
    assert.notEqual(result.status, "PASS");
  });

  it("does not FAIL solely from many benign WARNING docs when coverage is PASS", () => {
    // Large Worker ZIP packs can stamp WARNING on hundreds of docs (e.g. ETC
    // typing). Unbounded warningCount*10 used to zero source/security scores and
    // force totalScore FAIL despite 100% structure coverage.
    const structureCoverage = fakeCoverage("PASS");
    const documents = Array.from({ length: 80 }, (_, i) => ({
      id: `d${i}`,
      sourceType: "PRODUCT_MANUAL" as const,
      title: `doc ${i} overview product`,
      content: "product overview 개요 feature 기능 install setup configuration api usage",
      sourceUrl: null,
      validationStatus: "WARNING" as const,
      productVersion: "1.0",
    }));
    const result = runKnowledgeQuality({ structureCoverage, documents });
    assert.notEqual(result.status, "FAIL");
    assert.ok(result.totalScore >= 70, `expected totalScore>=70, got ${result.totalScore}`);
    assert.ok(result.sourceQualityScore >= 60);
  });

  it("fails when security blocker count on document", () => {
    const structureCoverage = fakeCoverage("PASS");
    const result = runKnowledgeQuality({
      structureCoverage,
      documents: [
        {
          id: "d1",
          sourceType: "PRODUCT_MANUAL",
          title: "doc",
          content: "enough content for quality scoring baseline",
          sourceUrl: null,
          validationStatus: "PASS",
          blockingIssueCount: 1,
        },
      ],
    });
    assert.equal(result.status, "FAIL");
  });
});
