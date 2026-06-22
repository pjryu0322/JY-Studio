import { describe, expect, it } from "vitest";
import {
  extractRequirementsMessagesForEventStore,
  mapServiceDesignStageToProcessStage,
} from "@/lib/project-process/projectEventMessageExtract";
import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

function sampleMessage(id: string, content: string, serviceDesignStage?: string) {
  return newRequirementsMessage({
    id,
    role: "user",
    speakerType: "USER",
    speakerId: "u1",
    speakerName: "테스트",
    messageType: "STATEMENT",
    content,
    meta: serviceDesignStage ? { serviceDesignStage: serviceDesignStage as never } : {},
  });
}

describe("extractRequirementsMessagesForEventStore", () => {
  it("extracts messages present only in next conversation", () => {
    const prev = { messages: [sampleMessage("m1", "hello")] };
    const next = {
      messages: [sampleMessage("m1", "hello"), sampleMessage("m2", "world")],
    };
    const extracted = extractRequirementsMessagesForEventStore({
      previousConversationJson: prev,
      nextConversationJson: next,
    });
    expect(extracted).toHaveLength(1);
    expect(extracted[0]?.message.id).toBe("m2");
  });

  it("excludes messages already in previous conversation", () => {
    const msg = sampleMessage("m1", "only");
    const extracted = extractRequirementsMessagesForEventStore({
      previousConversationJson: { messages: [msg] },
      nextConversationJson: { messages: [msg] },
    });
    expect(extracted).toHaveLength(0);
  });

  it("skips messages without id", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: {
        messages: [{ role: "user", content: "no id" }],
      },
    });
    expect(extracted).toHaveLength(0);
  });

  it("skips messages without content", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: {
        messages: [sampleMessage("m-empty", "   ")],
      },
    });
    expect(extracted).toHaveLength(0);
  });

  it("uses serviceDesignStage for process stage when present", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: {
        messages: [sampleMessage("m1", "x", "service-flow")],
      },
    });
    expect(extracted[0]?.stage).toBe(PROJECT_PROCESS_STAGES.REQUIREMENTS_SERVICE_FLOW);
  });

  it("uses fallbackStage when serviceDesignStage is absent", () => {
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: { messages: [sampleMessage("m1", "x")] },
      fallbackStage: PROJECT_PROCESS_STAGES.FEATURE_PLANNING,
    });
    expect(extracted[0]?.stage).toBe(PROJECT_PROCESS_STAGES.FEATURE_PLANNING);
  });

  it("dedupes duplicate ids within next conversation", () => {
    const msg = sampleMessage("dup", "one");
    const extracted = extractRequirementsMessagesForEventStore({
      nextConversationJson: { messages: [msg, msg] },
    });
    expect(extracted).toHaveLength(1);
  });
});

describe("mapServiceDesignStageToProcessStage", () => {
  it("maps ideation to requirements_ideation", () => {
    expect(mapServiceDesignStageToProcessStage("ideation", "fallback")).toBe(
      PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
    );
  });
});
