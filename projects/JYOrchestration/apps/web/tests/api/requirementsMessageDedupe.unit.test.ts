import { describe, expect, it } from "vitest";
import {
  dedupeRequirementsMessagesById,
  newRequirementsMessage,
} from "@/lib/requirements/requirementsMessage";

describe("dedupeRequirementsMessagesById", () => {
  it("keeps first message when ids collide", () => {
    const first = newRequirementsMessage({
      id: "dup-1",
      role: "user",
      speakerType: "USER",
      speakerId: "me",
      speakerName: "나",
      messageType: "STATEMENT",
      content: "first",
    });
    const second = newRequirementsMessage({
      id: "dup-1",
      role: "user",
      speakerType: "USER",
      speakerId: "me",
      speakerName: "나",
      messageType: "STATEMENT",
      content: "second",
    });
    const out = dedupeRequirementsMessagesById([first, second]);
    expect(out).toHaveLength(1);
    expect(out[0]?.content).toBe("first");
  });

  it("assigns unique fallback ids for rapid batch creation", () => {
    const ids = new Set(
      Array.from({ length: 20 }, () =>
        newRequirementsMessage({
          role: "user",
          speakerType: "USER",
          speakerId: "me",
          speakerName: "나",
          messageType: "STATEMENT",
          content: "x",
        }).id,
      ),
    );
    expect(ids.size).toBe(20);
  });
});
