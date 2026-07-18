import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type StaleClient = Prisma.TransactionClient | typeof prisma;

/**
 * Invalidate current service validations for a version without mutating historical PASS status.
 * Sets invalidatedAt on non-invalidated PASS/FAIL runs (append-only semantics).
 */
export async function markServiceValidationsStaleForVersion(
  versionId: string,
  client: StaleClient = prisma,
): Promise<number> {
  const result = await client.serviceValidationRun.updateMany({
    where: {
      versionId,
      status: { in: ["PASS", "FAIL"] },
      invalidatedAt: null,
    },
    data: { invalidatedAt: new Date() },
  });
  return result.count;
}
