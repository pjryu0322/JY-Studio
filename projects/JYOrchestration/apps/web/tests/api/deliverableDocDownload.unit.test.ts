import { describe, expect, it } from "vitest";
import { markdownToWordBodyHtml } from "@/lib/requirements/deliverableDocDownload";

describe("deliverableDocDownload", () => {
  it("converts markdown headings and lists to word-friendly html", () => {
    const html = markdownToWordBodyHtml(
      ["# 제목", "", "- 항목 A", "- 항목 B", "", "본문 한 줄"].join("\n"),
    );
    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>항목 A</li>");
    expect(html).toContain("<p>본문 한 줄</p>");
  });
});
