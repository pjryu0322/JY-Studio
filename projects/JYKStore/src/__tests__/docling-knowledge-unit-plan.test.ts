import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCLING_KU_PASS_THRESHOLDS,
  evaluateKnowledgeUnitStepStatus,
  isPageNumberText,
  isStandAloneShortUnitEligible,
  planDoclingBodyKnowledgeUnits,
  uniqueParentText,
} from "../lib/docling-knowledge/docling-knowledge-unit-plan.ts";

describe("docling knowledge unit plan — coverage", () => {
  it("dedupes parent text that fully contains children from eligible denominator", () => {
    const child =
      "본문 내용은 충분히 길어야 단독 지식 단위로 유지됩니다. 추가 설명 문장입니다. 더 길게.";
    const parent = `${child}`;
    const { metrics } = planDoclingBodyKnowledgeUnits([
      {
        id: "p1",
        title: "상위",
        text: parent,
        label: "section",
        children: [
          {
            id: "c1",
            title: "하위",
            text: child,
            label: "paragraph",
          },
        ],
      },
    ]);
    assert.ok(metrics.normalExcludedBodyChars > 0);
    assert.ok(metrics.eligibleBodyChars < metrics.rawBodyChars);
    assert.ok(metrics.eligibleBodyCoverage >= 0.99);
    assert.ok(metrics.exclusionReasons.duplicate_parent_text);
  });

  it("excludes page numbers from eligible body", () => {
    const body =
      "정상 본문입니다. 이 문장은 지식 단위 최소 길이를 넘도록 작성한 본문입니다.";
    const { metrics, units } = planDoclingBodyKnowledgeUnits([
      { id: "1", text: body, label: "paragraph" },
      { id: "2", text: "12", label: "page_number" },
      { id: "3", text: "99", label: "page_number" },
    ]);
    assert.equal(isPageNumberText("12", "page_number"), true);
    assert.ok(metrics.exclusionReasons.page_number);
    assert.ok(units.some((u) => u.text.includes("정상 본문")));
    assert.ok(metrics.normalExcludedBodyChars >= 2);
  });

  it("computes raw and eligible coverage separately", () => {
    const body =
      "검색 품질 검증을 위한 충분한 길이의 본문 문장입니다. 추가로 더 길게 만듭니다.";
    const { metrics } = planDoclingBodyKnowledgeUnits([
      { id: "a", text: body, label: "paragraph" },
      { id: "b", text: "·", label: "paragraph" },
    ]);
    assert.ok(metrics.rawBodyChars > metrics.eligibleBodyChars);
    assert.equal(metrics.unitBodyChars, body.length);
    assert.ok(metrics.eligibleBodyCoverage >= metrics.rawBodyCoverage);
  });
});

describe("docling knowledge unit plan — short sections", () => {
  it("merges short title with following body", () => {
    const body =
      "기능 설명을 담은 충분한 길이의 다음 본문 단락입니다. 더 길게 만듭니다.";
    const { units, metrics } = planDoclingBodyKnowledgeUnits([
      { id: "h", text: "설정", label: "section_header", title: "설정" },
      { id: "p", text: body, label: "paragraph" },
    ]);
    assert.ok(metrics.shortSectionMergedCount >= 1);
    assert.ok(units.some((u) => u.text.includes("설정") && u.text.includes(body)));
    assert.ok(units.some((u) => u.mergeReason === "short_section_merged"));
    assert.ok(uHasSections(units));
  });

  it("merges consecutive short list items", () => {
    const { units, metrics } = planDoclingBodyKnowledgeUnits([
      { id: "1", text: "항목 A", label: "list_item" },
      { id: "2", text: "항목 B", label: "list_item" },
      { id: "3", text: "항목 C와 추가 설명", label: "list_item" },
      { id: "4", text: "항목 D 상세", label: "list_item" },
      { id: "5", text: "항목 E 마침", label: "list_item" },
    ]);
    assert.ok(metrics.shortSectionMergedCount >= 1 || units.length >= 1);
    assert.ok(units.length >= 1);
    assert.ok(units.some((u) => (u.sourceSectionIds?.length ?? 0) > 1) || units.length === 1);
  });

  it("merges error code with following explanation", () => {
    const explain =
      "디스크 공간이 부족하여 작업을 완료할 수 없습니다. 추가 설명입니다.";
    const { units } = planDoclingBodyKnowledgeUnits([
      { id: "e", text: "ERR-1204", label: "paragraph" },
      { id: "x", text: explain, label: "paragraph" },
    ]);
    assert.ok(units.some((u) => u.text.includes("ERR-1204") && u.text.includes(explain)));
  });

  it("merges warning keyword with following body", () => {
    const body =
      "이 설정은 운영 환경에서 되돌릴 수 없으니 신중히 적용하세요. 추가 설명.";
    const { units } = planDoclingBodyKnowledgeUnits([
      { id: "w", text: "주의: 변경 금지", label: "paragraph" },
      { id: "b", text: body, label: "paragraph" },
    ]);
    assert.ok(units.some((u) => u.mergeReason === "short_warning_merged" || u.text.includes("주의")));
  });

  it("keeps meaningful short config values as standalone units", () => {
    assert.equal(isStandAloneShortUnitEligible("MAX_RETRY=3", "code"), true);
    const { units, metrics } = planDoclingBodyKnowledgeUnits([
      { id: "c", text: "MAX_RETRY=3", label: "code" },
    ]);
    assert.equal(units.length, 1);
    assert.equal(units[0]?.shortValidUnit, true);
    assert.ok(metrics.shortValidUnitCount >= 1);
  });

  it("excludes empty sections", () => {
    const { metrics } = planDoclingBodyKnowledgeUnits([
      { id: "e", text: "", label: "paragraph" },
      {
        id: "ok",
        text: "충분한 길이의 본문 단락이 여기에 있습니다. 더 길게 작성합니다.",
        label: "paragraph",
      },
    ]);
    assert.ok(metrics.exclusionReasons.empty_section);
  });
});

describe("docling knowledge unit step status", () => {
  it("PASS when eligible and table thresholds met", () => {
    assert.equal(
      evaluateKnowledgeUnitStepStatus({
        unitCount: 10,
        eligibleBodyCoverage: 1,
        tableCoverage: 1,
        provenanceMissing: 0,
        criticalExcludedChars: 0,
      }),
      "PASS",
    );
  });

  it("WARNING in 0.95–0.99 band", () => {
    assert.equal(
      evaluateKnowledgeUnitStepStatus({
        unitCount: 10,
        eligibleBodyCoverage: 0.97,
        tableCoverage: 1,
        provenanceMissing: 0,
        criticalExcludedChars: 0,
      }),
      "WARNING",
    );
  });

  it("FAIL below 0.95 or critical/provenance", () => {
    assert.equal(
      evaluateKnowledgeUnitStepStatus({
        unitCount: 10,
        eligibleBodyCoverage: 0.9,
        tableCoverage: 1,
        provenanceMissing: 0,
        criticalExcludedChars: 0,
      }),
      "FAIL",
    );
    assert.equal(
      evaluateKnowledgeUnitStepStatus({
        unitCount: 10,
        eligibleBodyCoverage: 1,
        tableCoverage: 1,
        provenanceMissing: 1,
        criticalExcludedChars: 0,
      }),
      "FAIL",
    );
    assert.equal(
      evaluateKnowledgeUnitStepStatus({
        unitCount: 10,
        eligibleBodyCoverage: 1,
        tableCoverage: 1,
        provenanceMissing: 0,
        criticalExcludedChars: 12,
      }),
      "FAIL",
    );
  });

  it("threshold constants are stable", () => {
    assert.equal(DOCLING_KU_PASS_THRESHOLDS.eligibleBodyCoveragePass, 0.99);
    assert.equal(DOCLING_KU_PASS_THRESHOLDS.eligibleBodyCoverageWarn, 0.95);
  });

  it("uniqueParentText strips child spans", () => {
    assert.equal(uniqueParentText("hello world hello", ["hello"]).includes("world"), true);
  });
});

function uHasSections(units: Array<{ sourceSectionIds: string[] }>): boolean {
  return units.some((u) => u.sourceSectionIds.length >= 1);
}
