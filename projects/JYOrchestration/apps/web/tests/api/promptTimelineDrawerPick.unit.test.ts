import { describe, expect, it } from "vitest";

import { pickIdeationBootstrapPromptTimelineEntries } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";

describe("pickIdeationBootstrapPromptTimelineEntries", () => {
  it("includes requirementsChatOrchestration entries", () => {
    const now = new Date().toISOString();
    const out = pickIdeationBootstrapPromptTimelineEntries(
      [
        {
          stage: "requirements",
          stageGroup: "service-planning",
          workspaceScreenKey: "requirements_ideation",
          action: "requirementsChatOrchestration",
          source: "llm",
          createdAt: now,
          responseText: "ok",
        },
      ],
      10
    );
    expect(out.length).toBe(1);
    expect(out[0]?.action).toBe("requirementsChatOrchestration");
  });
});

