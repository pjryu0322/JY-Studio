import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const packId = "rmategridh5webv60";
  const markers = await p.pipelineRun.findMany({
    where: { packId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      triggerType: true,
      status: true,
      workingCopyId: true,
      sourceRevisionId: true,
      createdAt: true,
      summary: true,
    },
  });
  console.log("runs", JSON.stringify(markers, null, 2));

  const wc = await p.workerZipWorkingCopy.findMany({
    where: { packId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      sourceRevisionId: true,
      createdAt: true,
      byteSize: true,
    },
  });
  console.log("workingCopies", wc);

  const inv = await p.knowledgeScopeInventory.findMany({
    where: { packId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      workingCopyId: true,
      includedCount: true,
      excludedCount: true,
      pendingCount: true,
      reviewRequiredCount: true,
      itemCount: true,
      sourceRevisionId: true,
    },
  });
  console.log("inventories", inv);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
