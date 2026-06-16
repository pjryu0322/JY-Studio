import { describe, expect, it } from "vitest";
import { RequirementsMessageRenderer } from "@/components/requirements/RequirementsMessageRenderer";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";
import { REQUIREMENTS_CHAT_MESSAGE_MARKDOWN_CLASS } from "@/lib/requirements/messageTextNormalize";

describe("RequirementsMessageRenderer markdown compact", () => {
  it("re-exports shared AI markdown renderer (no Quick Design-only renderer)", () => {
    expect(RequirementsMessageRenderer).toBeTypeOf("function");
    expect(RequirementsAiMessageMarkdown).toBeTypeOf("function");
  });

  it("uses messageMarkdown class constant for chat bubbles", () => {
    expect(REQUIREMENTS_CHAT_MESSAGE_MARKDOWN_CLASS).toBe("jyo-requirements-md messageMarkdown");
  });
});
