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

  it("includes bootstrapInterview entries even when stage is requirements", () => {
    const now = new Date().toISOString();
    const out = pickIdeationBootstrapPromptTimelineEntries(
      [
        {
          stage: "requirements",
          stageGroup: "service-planning",
          workspaceScreenKey: "requirements_ideation",
          action: "bootstrapInterview",
          source: "llm",
          createdAt: now,
          promptText: "p",
          responseText: "r",
        },
      ],
      10
    );
    expect(out.length).toBe(1);
    expect(out[0]?.action).toBe("bootstrapInterview");
  });

  it("returns newest bootstrapInterview entries first", () => {
    const older = "2020-01-01T00:00:00.000Z";
    const newer = "2020-01-02T00:00:00.000Z";
    const out = pickIdeationBootstrapPromptTimelineEntries(
      [
        {
          stage: "ideation",
          stageGroup: "service-planning",
          workspaceScreenKey: "requirements_ideation",
          action: "bootstrapInterview",
          source: "fallback",
          createdAt: older,
          responseText: "old",
        },
        {
          stage: "ideation",
          stageGroup: "service-planning",
          workspaceScreenKey: "requirements_ideation",
          action: "bootstrapInterview",
          source: "llm",
          createdAt: newer,
          responseText: "new",
        },
      ],
      10
    );
    expect(out.length).toBe(2);
    expect(out[0]?.createdAt).toBe(newer);
    expect(out[1]?.createdAt).toBe(older);
  });
});

