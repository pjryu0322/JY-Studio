import { describe, expect, it } from "vitest";
import { projectUpdateDataFromSpecVersionRow } from "@/lib/project-spec/projectSpecVersionSync";

describe("projectUpdateDataFromSpecVersionRow", () => {
  it("maps RESPONSE sourceData.responseId to confirmedSpecResponseId", () => {
    const d = new Date("2025-01-02T03:04:05.000Z");
    const out = projectUpdateDataFromSpecVersionRow({
      markdown: "# Spec",
      sourceType: "RESPONSE",
      sourceData: { responseId: "resp_abc" },
      createdAt: d,
    });
    expect(out.confirmedSpecMarkdown).toBe("# Spec");
    expect(out.confirmedSpecResponseId).toBe("resp_abc");
    expect(out.confirmedSpecSourceType).toBe("RESPONSE");
    expect(out.confirmedSpecAt).toEqual(d);
  });

  it("clears confirmedSpecResponseId for non-RESPONSE types", () => {
    const d = new Date("2025-01-02T03:04:05.000Z");
    const out = projectUpdateDataFromSpecVersionRow({
      markdown: "x",
      sourceType: "MANUAL_EDIT",
      sourceData: null,
      createdAt: d,
    });
    expect(out.confirmedSpecResponseId).toBeNull();
    expect(out.confirmedSpecSourceData).toBeNull();
  });
});
