import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RequirementsAiMessageMarkdown,
  resolveAiMessageMarkdownDisplayText,
} from "@/components/requirements/RequirementsAiMessageMarkdown";
import { RequirementsMessageRenderer } from "@/components/requirements/RequirementsMessageRenderer";
import { REQUIREMENTS_CHAT_MESSAGE_MARKDOWN_CLASS } from "@/lib/requirements/messageTextNormalize";

const CHAT_MD_CSS = readFileSync(
  join(process.cwd(), "src/components/requirements/requirementsMessageMarkdownChat.css"),
  "utf8",
);

describe("RequirementsMessageRenderer markdown compact", () => {
  it("re-exports shared AI markdown renderer (no Quick Design-only renderer)", () => {
    expect(RequirementsMessageRenderer).toBeTypeOf("function");
    expect(RequirementsAiMessageMarkdown).toBeTypeOf("function");
  });

  it("uses messageMarkdown class constant for chat bubbles", () => {
    expect(REQUIREMENTS_CHAT_MESSAGE_MARKDOWN_CLASS).toBe("jyo-requirements-md messageMarkdown");
  });
});

describe("chat markdown loose list CSS", () => {
  it("forces zero margin on li > p to beat inline paragraph styles", () => {
    expect(CHAT_MD_CSS).toMatch(/\.messageMarkdown li > p[\s\S]*margin:\s*0 !important/);
    expect(CHAT_MD_CSS).toMatch(/\.messageMarkdown li > \.messageMarkdownParagraph[\s\S]*margin:\s*0 !important/);
  });
});

describe("resolveAiMessageMarkdownDisplayText", () => {
  it("normalizes chat layout text before markdown render", () => {
    const raw = "생성된 산출물:\n\n- A\n\n- B";
    expect(resolveAiMessageMarkdownDisplayText(raw, "chat")).toBe("생성된 산출물:\n- A\n- B");
  });

  it("removes blank lines between Quick Design-style bullet items in chat layout", () => {
    const raw = [
      "생성된 산출물:",
      "",
      "- 프로젝트 요약서",
      "",
      "- 프로토타입 기획안",
      "",
      "- 서비스 흐름 문서",
    ].join("\n");
    const out = resolveAiMessageMarkdownDisplayText(raw, "chat");
    expect(out).not.toMatch(/\n\n-/);
    expect(out).toBe(
      "생성된 산출물:\n- 프로젝트 요약서\n- 프로토타입 기획안\n- 서비스 흐름 문서",
    );
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
