import { describe, expect, it } from "vitest";
import {
  RequirementsAiMessageMarkdown,
  resolveAiMessageMarkdownDisplayText,
} from "@/components/requirements/RequirementsAiMessageMarkdown";
import { RequirementsMessageRenderer } from "@/components/requirements/RequirementsMessageRenderer";
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

describe("resolveAiMessageMarkdownDisplayText", () => {
  it("normalizes chat layout text before markdown render", () => {
    const raw = "생성된 산출물:\n\n- A\n\n- B";
    expect(resolveAiMessageMarkdownDisplayText(raw, "chat")).toBe("생성된 산출물:\n- A\n- B");
  });

  it("preserves document layout newlines", () => {
    const raw = "line one\n\n\nline two";
    expect(resolveAiMessageMarkdownDisplayText(raw, "document")).toBe(raw);
  });

  it("preserves fenced code block newlines in chat layout", () => {
    const raw = "before\n\n```ts\na\n\nb\n```\n\nafter";
    const out = resolveAiMessageMarkdownDisplayText(raw, "chat");
    expect(out).toContain("```ts\na\n\nb\n```");
  });
});
