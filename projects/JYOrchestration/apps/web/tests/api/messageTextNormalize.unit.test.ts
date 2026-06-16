import { describe, expect, it } from "vitest";
import { normalizeUserVisibleMessageText } from "@/lib/requirements/messageTextNormalize";

describe("normalizeUserVisibleMessageText", () => {
  it("collapses three or more consecutive blank lines to two", () => {
    expect(normalizeUserVisibleMessageText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeUserVisibleMessageText("  hello\n\n  ")).toBe("hello");
  });

  it("preserves newlines inside fenced code blocks", () => {
    const input = "intro\n\n```ts\nline1\n\n\nline2\n```\n\n\noutro";
    const out = normalizeUserVisibleMessageText(input);
    expect(out).toContain("```ts\nline1\n\n\nline2\n```");
    expect(out).toBe("intro\n\n```ts\nline1\n\n\nline2\n```\n\noutro");
  });
});
