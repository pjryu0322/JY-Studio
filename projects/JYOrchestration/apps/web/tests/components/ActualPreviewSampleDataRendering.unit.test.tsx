import { describe, expect, it } from "vitest";
import { resolveCodeTaskFeaturePromptTemplate } from "@/lib/prototype/codeTaskPromptFeatureTemplates";

describe("ActualPreviewSampleDataRendering prompts", () => {
  it("mock_data prompt scopes work to sample files and requiresIntegrationChange for panels", () => {
    const mock = resolveCodeTaskFeaturePromptTemplate({
      title: "샘플 데이터",
      description: "sample",
      requirements: [],
      changeType: "data",
      roleKind: "mock_data",
    });
    const req = mock.implementationRequirements.join("\n");
    const ver = mock.verificationChecklist.join("\n");
    expect(req).toContain("src/data/sampleData.ts");
    expect(req).toContain("src/types/meeting.ts");
    expect(req).toContain("requiresIntegrationChange");
    expect(req).not.toContain("각 화면 패널은 sampleData.ts를 import");
    expect(ver).not.toContain("좌/중/우 패널이 동일 sampleData.ts를 참조");
    expect(ver).toContain("sampleDraftTimeline");
  });

  it("screen prompts may reference sampleData imports for integration tasks", () => {
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
