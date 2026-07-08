import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getStructureTemplateDefinition } from "@/lib/structure-quality/structure-template-definitions";
import { runStructureCoverage } from "@/lib/structure-quality/structure-coverage-runner";
import { STRUCTURE_TEMPLATE_KEYS } from "@/lib/structure-quality/structure-template-definitions";

function authSections() {
  const def = getStructureTemplateDefinition(STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION)!;
  return def.sections.map((s) => ({
    sectionKey: s.sectionKey,
    title: s.title,
    required: s.required,
    weight: s.weight,
    sourceTypes: s.sourceTypes,
    keywords: s.keywords,
  }));
}

describe("structure coverage runner", () => {
  it("passes when all required AUTH sections are covered", () => {
    const documents = [
      {
        id: "d1",
        sourceType: "PRODUCT_MANUAL",
        title: "인증 개요",
        content: "overview 개요 인증 로그인 설명",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d2",
        sourceType: "API_SPEC",
        title: "인증 요청 endpoint",
        content: "POST request 인증요청 method",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d3",
        sourceType: "API_SPEC",
        title: "결과 확인 status",
        content: "GET result 결과 확인 status",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d4",
        sourceType: "CALLBACK_GUIDE",
        title: "callback webhook",
        content: "callback webhook payload body",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d5",
        sourceType: "ERROR_CODE_TABLE",
        title: "error codes",
        content: "E001 error code 오류 조치",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d6",
        sourceType: "TEST_ENV_GUIDE",
        title: "sandbox test",
        content: "sandbox test 환경",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d7",
        sourceType: "OPERATION_GUIDE",
        title: "production 운영",
        content: "production prod 운영 환경",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d8",
        sourceType: "SAMPLE_CODE",
        title: "java spring sample",
        content: "java spring sample 예제 code",
        sourceUrl: null,
        validationStatus: "PASS",
      },
      {
        id: "d9",
        sourceType: "SECURITY_GUIDE",
        title: "security token",
        content: "security token signature 서명",
        sourceUrl: null,
        validationStatus: "PASS",
      },
    ];

    const result = runStructureCoverage({
      templateKey: STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION,
      sections: authSections(),
      documents,
    });

    assert.equal(result.status, "PASS");
    assert.equal(result.missingRequiredCount, 0);
    assert.ok(result.coverageScore >= 90);
  });

  it("marks CALLBACK_HANDLING missing when no matching doc", () => {
    const result = runStructureCoverage({
      templateKey: STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION,
      sections: authSections(),
      documents: [
        {
          id: "d1",
          sourceType: "PRODUCT_MANUAL",
          title: "개요",
          content: "overview 개요 인증",
          sourceUrl: null,
          validationStatus: "PASS",
        },
      ],
    });

    const callback = result.items.find((i) => i.sectionKey === "CALLBACK_HANDLING");
    assert.ok(callback);
    assert.equal(callback.covered, false);
    assert.ok(result.missingRequiredCount > 0);
  });

  it("excludes FAIL and NOT_CHECKED docs from coverage evidence", () => {
    const result = runStructureCoverage({
      templateKey: STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION,
      sections: authSections(),
      documents: [
        {
          id: "bad",
          sourceType: "CALLBACK_GUIDE",
          title: "callback webhook payload",
          content: "callback webhook payload",
          sourceUrl: null,
          validationStatus: "FAIL",
        },
      ],
    });

    const callback = result.items.find((i) => i.sectionKey === "CALLBACK_HANDLING");
    assert.equal(callback?.covered, false);
    assert.equal(result.status, "FAIL");
  });

  it("allows WARNING docs with warning signal", () => {
    const result = runStructureCoverage({
      templateKey: STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION,
      sections: authSections(),
      documents: [
        {
          id: "warn",
          sourceType: "CALLBACK_GUIDE",
          title: "callback webhook",
          content: "callback webhook payload guide",
          sourceUrl: null,
          validationStatus: "WARNING",
        },
      ],
    });

    const callback = result.items.find((i) => i.sectionKey === "CALLBACK_HANDLING");
    assert.equal(callback?.covered, true);
    assert.ok(callback?.matchedSignals.includes("source_validation_warning"));
  });
});
