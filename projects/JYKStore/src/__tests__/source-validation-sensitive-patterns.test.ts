import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanSensitivePatterns } from "@/lib/source-validation/source-validation-sensitive-patterns";

function hasBlocker(issues: ReturnType<typeof scanSensitivePatterns>) {
  return issues.some((i) => i.severity === "BLOCKER");
}

describe("source validation sensitive patterns", () => {
  it("detects private key as blocker", () => {
    const issues = scanSensitivePatterns("-----BEGIN PRIVATE KEY-----\nMIIE");
    assert.ok(issues.some((i) => i.severity === "BLOCKER" && i.code === "SENSITIVE_SECRET_DETECTED"));
  });

  it("detects apiKey value assignment as blocker", () => {
    const issues = scanSensitivePatterns('config = { apiKey: "abcd1234" }');
    assert.ok(issues.some((i) => i.severity === "BLOCKER"));
  });

  it("detects phone as warning", () => {
    const issues = scanSensitivePatterns("Call 010-1234-5678 for help.");
    assert.ok(issues.some((i) => i.severity === "WARNING" && i.code === "POTENTIAL_PERSONAL_DATA"));
  });

  it("does not block client_secret field documentation", () => {
    const issues = scanSensitivePatterns("client_secret 파라미터를 전달합니다.");
    assert.equal(hasBlocker(issues), false);
    assert.ok(issues.some((i) => i.code === "OAUTH_FIELD_NAME_MENTION"));
  });

  it("does not block access_token field documentation", () => {
    const issues = scanSensitivePatterns("access_token 응답 필드입니다.");
    assert.equal(hasBlocker(issues), false);
    assert.ok(issues.some((i) => i.code === "OAUTH_FIELD_NAME_MENTION"));
  });

  it("does not block refresh_token field documentation", () => {
    const issues = scanSensitivePatterns("refresh_token은 갱신 토큰입니다.");
    assert.equal(hasBlocker(issues), false);
    assert.ok(issues.some((i) => i.code === "OAUTH_FIELD_NAME_MENTION"));
  });

  it("blocks client_secret value assignment", () => {
    const issues = scanSensitivePatterns("client_secret=super-secret-value");
    assert.ok(hasBlocker(issues));
  });

  it("blocks Authorization Bearer long token", () => {
    const token = "a".repeat(24);
    const issues = scanSensitivePatterns(`Authorization: Bearer ${token}`);
    assert.ok(hasBlocker(issues));
  });
});
