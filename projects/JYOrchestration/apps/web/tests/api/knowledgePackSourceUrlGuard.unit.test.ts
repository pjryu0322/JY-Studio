import { describe, expect, it, vi } from "vitest";
import * as dns from "node:dns";
import {
  isBlockedHostname,
  isBlockedResolvedIpAddress,
  validateUrlForKnowledgePackFetch,
  validateUrlForKnowledgePackFetchWithDns,
} from "@/lib/knowledge-packs/knowledgePackSourceUrlGuard";

describe("knowledgePackSourceUrlGuard (sync)", () => {
  it("blocks localhost", () => {
    expect(validateUrlForKnowledgePackFetch("http://localhost/foo").ok).toBe(false);
  });
  it("blocks 127.0.0.1", () => {
    expect(validateUrlForKnowledgePackFetch("http://127.0.0.1/foo").ok).toBe(false);
  });
  it("blocks 10.x", () => {
    expect(validateUrlForKnowledgePackFetch("http://10.2.3.4/").ok).toBe(false);
  });
  it("blocks 172.16–31", () => {
    expect(validateUrlForKnowledgePackFetch("http://172.20.1.1/").ok).toBe(false);
  });
  it("blocks 192.168.x", () => {
    expect(validateUrlForKnowledgePackFetch("http://192.168.1.1/").ok).toBe(false);
  });
  it("blocks file and javascript", () => {
    expect(validateUrlForKnowledgePackFetch("file:///etc/passwd").ok).toBe(false);
    expect(validateUrlForKnowledgePackFetch("javascript:alert(1)").ok).toBe(false);
    expect(validateUrlForKnowledgePackFetch("data:text/html,hi").ok).toBe(false);
  });
  it("allows https public style url string", () => {
    const r = validateUrlForKnowledgePackFetch("https://example.com/path");
    expect(r.ok).toBe(true);
  });
});

describe("isBlockedResolvedIpAddress", () => {
  it("blocks ::1 and fe80", () => {
    expect(isBlockedResolvedIpAddress("::1", 6)).toBe(true);
    expect(isBlockedResolvedIpAddress("fe80::1", 6)).toBe(true);
  });
  it("blocks unique local fc/fd", () => {
    expect(isBlockedResolvedIpAddress("fd00::1", 6)).toBe(true);
    expect(isBlockedResolvedIpAddress("fc00::1", 6)).toBe(true);
  });
  it("blocks ipv4-mapped loopback", () => {
    expect(isBlockedResolvedIpAddress("::ffff:127.0.0.1", 6)).toBe(true);
  });
});

describe("validateUrlForKnowledgePackFetchWithDns (mocked lookup)", () => {
  it("rejects when DNS resolves to private IPv4", async () => {
    const spy = vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "10.0.0.1", family: 4 });
    const r = await validateUrlForKnowledgePackFetchWithDns("https://public.example/resource");
    expect(r.ok).toBe(false);
    spy.mockRestore();
  });

  it("passes when DNS resolves to public IPv4", async () => {
    const spy = vi.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    const r = await validateUrlForKnowledgePackFetchWithDns("https://example.com/");
    expect(r.ok).toBe(true);
    spy.mockRestore();
  });
});

describe("isBlockedHostname", () => {
  it("treats literal 127 as blocked", () => {
    expect(isBlockedHostname("127.0.0.2")).toBe(true);
  });
});
