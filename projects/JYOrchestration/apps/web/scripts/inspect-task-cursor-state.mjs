import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.project.count({ where: { deletedAt: null } });
    console.log("projectCount", count);
    const target = await prisma.project.findUnique({
      where: { id: "cmphxk7y10015unj0wjms1uch" },
      select: { id: true, name: true, requirementsStateJson: true },
    });
    console.log("target", target ? { id: target.id, name: target.name, hasState: Boolean(target.requirementsStateJson) } : null);
    if (target?.requirementsStateJson && typeof target.requirementsStateJson === "object") {
      const keys = Object.keys(target.requirementsStateJson).slice(0, 30);
      console.log("stateKeys", keys);
      console.log("taskCursor", target.requirementsStateJson.taskCursorExecutionV1 ?? null);
      console.log("quickRun", target.requirementsStateJson.implementationQuickRunV1 ?? null);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
