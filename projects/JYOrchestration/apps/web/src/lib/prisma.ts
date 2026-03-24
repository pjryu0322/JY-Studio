import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function buildPrismaLog(): Prisma.LogLevel[] {
  const levels: Prisma.LogLevel[] = ["warn", "error"];
  const q = process.env.PRISMA_LOG_QUERY?.trim().toLowerCase();
  if (q === "1" || q === "true" || q === "yes") {
    levels.push("query");
  }
  return levels;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: buildPrismaLog(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
