import { describe, expect, it } from "vitest";
import { parseKnowledgePackDocument, stripHtmlToPlainText } from "@/lib/knowledge-packs/knowledgePackDocumentParser";

describe("knowledgePackDocumentParser", () => {
  it("stripHtmlToPlainText removes tags and keeps text", () => {
    const html = "<html><body><p>Hello <b>world</b></p></body></html>";
    expect(stripHtmlToPlainText(html)).toMatch(/Hello world/i);
  });

  it("parseKnowledgePackDocument parses html title", () => {
    const r = parseKnowledgePackDocument({
      raw: "<html><head><title>My Doc</title></head><body><p>Body text here</p></body></html>",
      contentType: "text/html",
    });
    expect(r.title).toContain("My Doc");
    expect(r.plainText.toLowerCase()).toContain("body text");
  });

  it("parseKnowledgePackDocument handles markdown-ish body", () => {
    const r = parseKnowledgePackDocument({
      raw: "# Title line\n\nSome **bold** content.",
      contentType: "text/plain",
      sourceType: "MARKDOWN",
    });
    expect(r.detectedType).toBe("markdown");
    expect(r.plainText.toLowerCase()).toContain("bold");
  });
});
