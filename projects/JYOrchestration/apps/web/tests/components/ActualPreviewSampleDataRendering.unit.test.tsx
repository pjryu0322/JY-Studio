import { describe, expect, it } from "vitest";
import { resolveCodeTaskFeaturePromptTemplate } from "@/lib/prototype/codeTaskPromptFeatureTemplates";

describe("ActualPreviewSampleDataRendering prompts", () => {
  it("mock_data and screen prompts require central sampleData.ts imports", () => {
    const mock = resolveCodeTaskFeaturePromptTemplate({
      title: "샘플 데이터",
      description: "sample",
      requirements: [],
      changeType: "data",
      roleKind: "mock_data",
    });
    expect(mock.implementationRequirements.join("\n")).toContain("src/data/sampleData.ts");
    expect(mock.implementationRequirements.join("\n")).toContain("여기에 표시됩니다");

    const screen = resolveCodeTaskFeaturePromptTemplate({
      title: "입력 화면",
      description: "screen",
      requirements: [],
      changeType: "component",
      roleKind: "screen_input",
    });
    expect(screen.implementationRequirements.join("\n")).toContain("sampleMeetingFiles");
  });
});
