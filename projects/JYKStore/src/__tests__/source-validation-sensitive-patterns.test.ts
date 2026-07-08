import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanSensitivePatterns } from "@/lib/source-validation/source-validation-sensitive-patterns";

describe("source validation sensitive patterns", () => {
  it("detects private key as blocker", () => {
    const issues = scanSensitivePatterns("-----BEGIN PRIVATE KEY-----\nMIIE");
    assert.ok(issues.some((i) => i.severity === "BLOCKER" && i.code === "SENSITIVE_SECRET_DETECTED"));
  });

  it("detects apiKey as blocker", () => {
    const issues = scanSensitivePatterns('config = { apiKey: "abcd1234" }');
    assert.ok(issues.some((i) => i.severity === "BLOCKER"));
  });

  it("detects phone as warning", () => {
    const issues = scanSensitivePatterns("Call 010-1234-5678 for help.");
    assert.ok(issues.some((i) => i.severity === "WARNING" && i.code === "POTENTIAL_PERSONAL_DATA"));
  });
});
