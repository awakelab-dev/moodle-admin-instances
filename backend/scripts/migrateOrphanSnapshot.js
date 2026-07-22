require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const mongoose = require('mongoose');
const PlatformSnapshot = require('../src/models/PlatformSnapshot');
const { slugifyPlatform } = require('../src/config/platformConfig');

const prisma = new PrismaClient();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const orphanUrl = 'https://plataforma-aspasia.grupoaspasia.com';
  const orphanName = 'SERVICIOS DE FORMACION ASPASIA S.L.';

  const platform = await prisma.platform.create({
    data: {
      name: orphanName,
      slug: slugifyPlatform(orphanName),
      url: orphanUrl,
      token: '',
      monthlyCharge: null,
      currency: 'USD',
      isActive: false,
    },
  });
  console.log('Created placeholder platform:', platform.id, platform.name);

  const snapshots = await PlatformSnapshot.find({ moodle_source: orphanUrl }).lean();
  const data = snapshots.map((s) => ({
    platformId: platform.id,
    moodleName: s.moodle_name || '',
    month: s.month,
    totalBytes: BigInt(s.total_bytes || 0),
    monthlyCharge: s.monthly_charge,
    costPerGb: s.cost_per_gb,
    currency: 'USD',
    income: s.income,
    cost: s.cost,
    margin: s.margin,
    syncedAt: s.synced_at || new Date(),
  }));
  const result = await prisma.platformSnapshot.createMany({ data, skipDuplicates: true });
  console.log('Migrated orphan snapshots:', result.count);

  const total = await prisma.platformSnapshot.count();
  console.log('Total platform_snapshots now:', total);

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
