import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  await p.$queryRawUnsafe("SELECT 1 as ok");
  console.log("db_ok");
  const cats = await p.packCategory.findMany({
    take: 5,
    select: { categoryId: true, name: true },
  });
  console.log("cats", JSON.stringify(cats, null, 2));
  const users = await p.user.findMany({
    where: { accountRole: { in: ["ADMIN", "PROVIDER"] } },
    take: 20,
    select: { id: true, email: true, accountRole: true, name: true },
  });
  console.log("users", JSON.stringify(users, null, 2));
  const profiles = await p.providerProfile.findMany({
    take: 5,
    select: { id: true, userId: true, displayName: true, clientId: true },
  });
  console.log("profiles", JSON.stringify(profiles, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
