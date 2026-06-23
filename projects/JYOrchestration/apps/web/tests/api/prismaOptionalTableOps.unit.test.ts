import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  isPrismaMissingTableError,
  runPrismaIgnoreMissingTable,
} from "@/lib/prisma/prismaOptionalTableOps";

describe("prismaOptionalTableOps", () => {
  it("detects P2021 missing table", () => {
    const err = new Prisma.PrismaClientKnownRequestError("missing", {
      code: "P2021",
      clientVersion: "test",
    });
    expect(isPrismaMissingTableError(err)).toBe(true);
  });

  it("returns missing_table when operation throws P2021", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("missing", {
      code: "P2021",
      clientVersion: "test",
    });
    const result = await runPrismaIgnoreMissingTable(async () => {
      throw err;
    });
    expect(result).toBe("missing_table");
  });

  it("rethrows non-P2021 errors", async () => {
    await expect(
      runPrismaIgnoreMissingTable(async () => {
        throw new Error("other");
      }),
    ).rejects.toThrow("other");
  });
});
