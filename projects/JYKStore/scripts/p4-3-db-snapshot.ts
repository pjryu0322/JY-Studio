import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const packs = await p.knowledgePack.findMany({
    where: { packId: { contains: "rmate" } },
    select: { packId: true, name: true, status: true },
    take: 5,
  });
  console.log("packs", JSON.stringify(packs, null, 2));
  if (!packs[0]) return;
  const packId = packs[0].packId;
  const v = await p.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, currentWorkingCopyId: true },
  });
  console.log("version", v);
  const inv = await p.knowledgeScopeInventory.findMany({
    where: { versionId: v?.id },
    select: {
      id: true,
      status: true,
      workingCopyId: true,
      includedCount: true,
      excludedCount: true,
      pendingCount: true,
      reviewRequiredCount: true,
      itemCount: true,
    },
    take: 5,
  });
  console.log("inventories", inv);
  const runs = await p.pipelineRun.findMany({
    where: { packId, triggerType: { in: ["WORKER_ZIP_IMPORT", "WORKER_ZIP_REQUEST"] } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      status: true,
      triggerType: true,
      createdAt: true,
      finishedAt: true,
      summary: true,
      workingCopyId: true,
      sourceRevisionId: true,
    },
  });
  console.log("runs", runs);
  const gens = await p.searchIndexGeneration.findMany({
    where: { versionId: v?.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      status: true,
      chunkCount: true,
      embeddedCount: true,
      createdAt: true,
      failureCode: true,
    },
  });
  console.log("gens", gens);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
