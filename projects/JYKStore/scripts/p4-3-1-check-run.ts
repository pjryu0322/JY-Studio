import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const packId = "p431e2ems633k5n";
  const runs = await p.pipelineRun.findMany({
    where: { packId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      triggerType: true,
      status: true,
      summary: true,
      createdAt: true,
      finishedAt: true,
      workingCopyId: true,
      sourceRevisionId: true,
    },
  });
  console.log(JSON.stringify(runs, null, 2));
  const steps = await p.pipelineStepLog.findMany({
    where: { runId: { in: runs.map((r) => r.id) } },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { runId: true, stepKey: true, status: true, detail: true, createdAt: true },
  }).catch(() => []);
  console.log("steps", JSON.stringify(steps, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
