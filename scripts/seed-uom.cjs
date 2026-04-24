const { PrismaClient } = require('@prisma/client');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

const prisma = new PrismaClient();

const UOMS = [
  { code: 'PCS', name: 'Pieces', description: 'Satuan per item/pcs' },
  { code: 'BOX', name: 'Box', description: 'Satuan per box/karton' },
  { code: 'CTN', name: 'Carton', description: 'Satuan per carton' },
  { code: 'PALLET', name: 'Pallet', description: 'Satuan per pallet' },
  { code: 'KG', name: 'Kilogram', description: 'Satuan berat kilogram' },
  { code: 'GRAM', name: 'Gram', description: 'Satuan berat gram' },
  { code: 'LITER', name: 'Liter', description: 'Satuan volume liter' },
  { code: 'ML', name: 'Milliliter', description: 'Satuan volume mililiter' },
];

async function main() {
  for (const row of UOMS) {
    await prisma.unitOfMeasure.upsert({
      where: { code: row.code },
      update: {
        name: row.name,
        description: row.description,
        isActive: true,
      },
      create: {
        code: row.code,
        name: row.name,
        description: row.description,
        isActive: true,
      },
    });
  }

  console.log(`UOM seed completed (${UOMS.length} rows).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
