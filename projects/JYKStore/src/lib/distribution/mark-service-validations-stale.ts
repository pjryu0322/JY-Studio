import { prisma } from "@/lib/prisma";

/** Mark active PASS/FAIL service validations as STALE for a version (e.g. after pipeline rerun). */
export async function markServiceValidationsStaleForVersion(versionId: string): Promise<number> {
  const result = await prisma.serviceValidationRun.updateMany({
    where: {
      versionId,
      status: { in: ["PASS", "FAIL"] },
    },
    data: { status: "STALE" },
  });
  return result.count;
}
