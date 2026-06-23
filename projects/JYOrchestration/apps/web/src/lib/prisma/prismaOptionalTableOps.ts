import { Prisma } from "@prisma/client";

export function isPrismaMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

/** DB에 테이블이 없으면(P2021) 무시 — 로컬/구버전 DB와의 호환 */
export async function runPrismaIgnoreMissingTable(
  run: () => Promise<unknown>,
): Promise<"ok" | "missing_table"> {
  try {
    await run();
    return "ok";
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return "missing_table";
    }
    throw error;
  }
}
