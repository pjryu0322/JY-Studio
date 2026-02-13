const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const items = Array.from({ length: 50 }, (_, i) => {
    const n = String(i + 1).padStart(4, '0');
    return {
      code: `DUMMY${n}`,
      name: `더미종목-${i + 1}`,
      market: i % 2 === 0 ? 'KOSPI' : 'KOSDAQ',
    };
  });

  for (const item of items) {
    await prisma.stock_master.upsert({
      where: { code: item.code },
      update: { name: item.name, market: item.market },
      create: item,
    });
  }

  console.log(`Seed completed: ${items.length} stocks`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
