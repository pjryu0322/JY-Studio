import { describe, expect, it } from "vitest";
import {
  assertSafePublicHttpUrl,
  extractUrlsFromTranscript,
} from "@/lib/conversation-core/websiteInspection";

describe("extractUrlsFromTranscript", () => {
  it("extracts recent user URLs, dedupes, ignores assistant", () => {
    const urls = extractUrlsFromTranscript([
      { role: "assistant", content: "https://evil.example.com/ignore" },
      { role: "user", content: "https://www.modoo.or.kr/idea/list" },
      { role: "user", content: "확인해줘" },
    ]);
    expect(urls).toEqual(["https://www.modoo.or.kr/idea/list"]);
  });

  it("returns multiple recent unique user URLs up to max", () => {
    const urls = extractUrlsFromTranscript(
      [
        { role: "user", content: "https://a.example.com/1" },
        { role: "user", content: "https://b.example.com/2" },
      ],
      3
    );
    expect(urls).toEqual(["https://b.example.com/2", "https://a.example.com/1"]);
  });
});

describe("assertSafePublicHttpUrl", () => {
  it("allows https://example.com", () => {
    expect(assertSafePublicHttpUrl("https://example.com/path").ok).toBe(true);
  });

  it("blocks localhost and loopback", () => {
    expect(assertSafePublicHttpUrl("http://localhost/").ok).toBe(false);
    expect(assertSafePublicHttpUrl("http://127.0.0.1/").ok).toBe(false);
  });

  it("blocks private IPv4", () => {
    expect(assertSafePublicHttpUrl("http://192.168.1.1/").ok).toBe(false);
    expect(assertSafePublicHttpUrl("http://10.0.0.5/").ok).toBe(false);
    expect(assertSafePublicHttpUrl("http://172.16.0.1/").ok).toBe(false);
  });

  it("blocks non-http schemes", () => {
    expect(assertSafePublicHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(assertSafePublicHttpUrl("javascript:alert(1)").ok).toBe(false);
  });
});
