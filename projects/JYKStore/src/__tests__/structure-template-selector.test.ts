import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectStructureTemplateKey } from "@/lib/structure-quality/structure-template-selector";
import { STRUCTURE_TEMPLATE_KEYS } from "@/lib/structure-quality/structure-template-definitions";

describe("structure template selector", () => {
  it("selects AUTH_INTEGRATION for auth-related category", () => {
    const key = selectStructureTemplateKey({
      categoryId: "easy-auth",
      tags: [],
      sourceTypes: ["PRODUCT_MANUAL"],
    });
    assert.equal(key, STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION);
  });

  it("selects AUTH_INTEGRATION when auth signal source types dominate", () => {
    const key = selectStructureTemplateKey({
      categoryId: "integration",
      tags: [],
      sourceTypes: ["API_SPEC", "CALLBACK_GUIDE", "ERROR_CODE_TABLE", "SAMPLE_CODE"],
    });
    assert.equal(key, STRUCTURE_TEMPLATE_KEYS.AUTH_INTEGRATION);
  });

  it("selects GENERIC_PRODUCT for general docs", () => {
    const key = selectStructureTemplateKey({
      categoryId: "general",
      tags: ["docs"],
      sourceTypes: ["PRODUCT_MANUAL", "FAQ"],
    });
    assert.equal(key, STRUCTURE_TEMPLATE_KEYS.GENERIC_PRODUCT);
  });
});
