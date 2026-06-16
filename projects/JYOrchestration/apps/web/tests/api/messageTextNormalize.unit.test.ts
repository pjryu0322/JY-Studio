import { describe, expect, it } from "vitest";
import {
  formatCompactBulletSection,
  normalizeTextOutsideCodeBlocks,
  normalizeUserVisibleMessageText,
  REQUIREMENTS_CHAT_MESSAGE_MARKDOWN_CLASS,
} from "@/lib/requirements/messageTextNormalize";

describe("normalizeUserVisibleMessageText", () => {
  it("collapses three or more consecutive blank lines to two", () => {
    expect(normalizeUserVisibleMessageText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeUserVisibleMessageText("  hello\n\n  ")).toBe("hello");
  });

  it("removes blank lines between bullets", () => {
    const input = "생성된 산출물:\n\n- A\n\n- B\n\n- C";
    expect(normalizeUserVisibleMessageText(input)).toBe("생성된 산출물:\n- A\n- B\n- C");
  });

  it("removes blank lines between numbered list items", () => {
    const input = "1. first\n\n2. second\n\n3. third";
    expect(normalizeUserVisibleMessageText(input)).toBe("1. first\n2. second\n3. third");
  });

  it("places bullets immediately after section title colon", () => {
    const input = "구현 준비 정보:\n\n\n- A\n\n- B";
    expect(normalizeUserVisibleMessageText(input)).toBe("구현 준비 정보:\n- A\n- B");
  });

  it("preserves newlines inside fenced code blocks", () => {
    const input = "intro\n\n```ts\nline1\n\n\nline2\n```\n\n\noutro";
    const out = normalizeUserVisibleMessageText(input);
    expect(out).toContain("```ts\nline1\n\n\nline2\n```");
    expect(out).toBe("intro\n\n```ts\nline1\n\n\nline2\n```\n\noutro");
  });
});

describe("formatCompactBulletSection", () => {
  it("builds compact bullet block without extra blank lines", () => {
    const text = formatCompactBulletSection("생성된 산출물", ["A", "B"]);
    expect(text).toBe("생성된 산출물:\n- A\n- B");
    expect(text).not.toMatch(/\n\n/);
  });
});

describe("normalizeTextOutsideCodeBlocks", () => {
  it("exports chat markdown root class for renderer", () => {
    expect(REQUIREMENTS_CHAT_MESSAGE_MARKDOWN_CLASS).toContain("messageMarkdown");
  });
});
