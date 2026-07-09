import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createStoreAuthSessionToken,
  parseStoreAuthSessionToken,
} from "../lib/auth-session.ts";

describe("auth session tokens", () => {
  it("round-trips a signed session payload", () => {
    const prev = process.env.JYKSTORE_API_KEY_SECRET;
    process.env.JYKSTORE_API_KEY_SECRET = "test-auth-secret";

    try {
      const token = createStoreAuthSessionToken({
        userId: "user-1",
        email: "dev@example.com",
        name: "Dev User",
      });
      const parsed = parseStoreAuthSessionToken(token);
      assert.ok(parsed);
      assert.equal(parsed.userId, "user-1");
      assert.equal(parsed.email, "dev@example.com");
    } finally {
      if (prev === undefined) delete process.env.JYKSTORE_API_KEY_SECRET;
      else process.env.JYKSTORE_API_KEY_SECRET = prev;
    }
  });

  it("rejects tampered tokens", () => {
    const prev = process.env.JYKSTORE_API_KEY_SECRET;
    process.env.JYKSTORE_API_KEY_SECRET = "test-auth-secret";

    try {
      const token = createStoreAuthSessionToken({
        userId: "user-1",
        email: "dev@example.com",
        name: "Dev User",
      });
      const tampered = `${token}x`;
      assert.equal(parseStoreAuthSessionToken(tampered), null);
    } finally {
      if (prev === undefined) delete process.env.JYKSTORE_API_KEY_SECRET;
      else process.env.JYKSTORE_API_KEY_SECRET = prev;
    }
  });
});
