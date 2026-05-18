import { describe, expect, it } from "vitest";

import { serializeAccountPasswordChangeBody } from "@/lib/user/accountPasswordChange";

describe("serializeAccountPasswordChangeBody", () => {
  it("serializes current and new password fields for PATCH /api/me/password", () => {
    const raw = serializeAccountPasswordChangeBody("cur", "next");
    expect(JSON.parse(raw)).toEqual({ currentPassword: "cur", newPassword: "next" });
  });
});
