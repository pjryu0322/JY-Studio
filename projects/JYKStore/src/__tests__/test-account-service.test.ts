import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveTestAccountDisplayName,
  sortTestAccounts,
  toTestAccountDto,
  TEST_ACCOUNT_LIST_LIMIT,
} from "../lib/test-account-service.ts";

describe("test-account-service", () => {
  it("resolves displayName fallbacks", () => {
    assert.equal(resolveTestAccountDisplayName({ name: " 홍길동 ", email: "a@b.com" }), "홍길동");
    assert.equal(resolveTestAccountDisplayName({ name: "  ", email: "admin@example.com" }), "admin");
    assert.equal(resolveTestAccountDisplayName({ name: null, email: "@example.com" }), "사용자");
  });

  it("maps DTO with role label and drops empty email", () => {
    const dto = toTestAccountDto({
      id: "u1",
      email: "Admin@Example.com",
      name: "관리자",
      accountRole: "ADMIN",
    });
    assert.deepEqual(dto, {
      id: "u1",
      email: "admin@example.com",
      displayName: "관리자",
      accountRole: "ADMIN",
      roleLabel: "관리자",
    });
    assert.equal(toTestAccountDto({ id: "x", email: null, name: "n", accountRole: "USER" }), null);
    assert.equal(toTestAccountDto({ id: "x", email: "  ", name: "n", accountRole: "USER" }), null);
  });

  it("sorts ADMIN → PROVIDER → USER then name/email", () => {
    const sorted = sortTestAccounts([
      { accountRole: "USER" as const, displayName: "B", email: "b@x.com" },
      { accountRole: "ADMIN" as const, displayName: "Z", email: "z@x.com" },
      { accountRole: "PROVIDER" as const, displayName: "A", email: "a@x.com" },
      { accountRole: "USER" as const, displayName: "A", email: "a2@x.com" },
      { accountRole: "USER" as const, displayName: "A", email: "a1@x.com" },
    ]);
    assert.deepEqual(
      sorted.map((row) => `${row.accountRole}:${row.displayName}:${row.email}`),
      [
        "ADMIN:Z:z@x.com",
        "PROVIDER:A:a@x.com",
        "USER:A:a1@x.com",
        "USER:A:a2@x.com",
        "USER:B:b@x.com",
      ],
    );
  });

  it("exposes list limit of 100", () => {
    assert.equal(TEST_ACCOUNT_LIST_LIMIT, 100);
  });
});
