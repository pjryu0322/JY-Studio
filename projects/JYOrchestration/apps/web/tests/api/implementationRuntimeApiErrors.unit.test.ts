import { describe, expect, it } from "vitest";
import {
  formatImplementationRuntimeApiError,
  isImplementationRuntimeSchemaError,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeApiErrors";

describe("implementationRuntimeApiErrors", () => {
  it("maps Prisma P2022 to migrate hint", () => {
    const msg = formatImplementationRuntimeApiError({ code: "P2022", message: "column foo" });
    expect(msg).toContain("pnpm db:migrate");
    expect(isImplementationRuntimeSchemaError({ code: "P2022" })).toBe(true);
  });

  it("passes through generic errors", () => {
    expect(formatImplementationRuntimeApiError(new Error("boom"))).toBe("boom");
    expect(isImplementationRuntimeSchemaError(new Error("boom"))).toBe(false);
  });
});
