require('dotenv').config();
const mongoose = require('mongoose');
const PlatformSnapshot = require('../src/models/PlatformSnapshot');
const {
  calculateFinancialMetrics,
  normalizeCurrency,
  readPlatformConfig,
  writePlatformConfig,
} = require('../src/config/platformConfig');

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/moodle-admin-instances';
const MONTHS_TO_SEED = 12;
const DEFAULT_MONTHLY_SPIKE_PATTERN = [
  0.82,
  0.94,
  1.08,
  0.88,
  1.46,
  0.96,
  1.92,
  1.04,
  1.28,
  0.9,
  1.64,
  1,
];

function buildMonthKeyFromOffset(offset) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCMonth(date.getUTCMonth() - offset);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getHistoricalFactor(platformIndex, pointIndex, totalPoints) {
  if (totalPoints <= 1 || pointIndex === totalPoints - 1) return 1;

  const startFactor = Math.max(0.52, 0.76 - (platformIndex % 5) * 0.045);
  const progress = pointIndex / (totalPoints - 1);
  return startFactor + (1 - startFactor) * Math.pow(progress, 1.1);
}

function getMonthlySpikeFactor(platformIndex, pointIndex, totalPoints) {
  if (totalPoints <= 1 || pointIndex === totalPoints - 1) return 1;

  const patternIndex =
    totalPoints === DEFAULT_MONTHLY_SPIKE_PATTERN.length
      ? pointIndex
      : Math.round(
          (pointIndex / Math.max(totalPoints - 1, 1)) *
            (DEFAULT_MONTHLY_SPIKE_PATTERN.length - 1)
        );
  const baseFactor = DEFAULT_MONTHLY_SPIKE_PATTERN[patternIndex] || 1;
  const platformWave = 1 + ((platformIndex % 4) - 1.5) * 0.05;

  return baseFactor * platformWave;
}

async function aggregateCurrentPlatformTotals(db) {
  return db
    .collection('courses')
    .aggregate([
      {
        $group: {
          _id: '$moodle_source',
          name: { $first: '$moodle_name' },
          totalBytes: {
            $sum: {
              $add: [
                { $ifNull: ['$size_bytes', 0] },
                { $ifNull: ['$backup_size_bytes', 0] },
                { $ifNull: ['$assignment_size_bytes', 0] },
                { $ifNull: ['$forum_size_bytes', 0] },
              ],
            },
          },
        },
      },
      { $sort: { totalBytes: -1, _id: 1 } },
    ])
    .toArray();
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  try {
    const db = mongoose.connection.db;
    const totals = await aggregateCurrentPlatformTotals(db);

    if (!totals.length) {
      throw new Error(
        'No hay datos en la colección courses para sembrar histórico.'
      );
    }

    const currentPlatforms = readPlatformConfig();
    const configuredBySource = new Map(
      currentPlatforms.map((platform) => [platform.url, platform])
    );
    let configChanged = false;

    const updatedPlatforms = currentPlatforms.map((platform) => {
      const normalizedCurrency = normalizeCurrency();
      const needsMonthlyCharge = !Number.isFinite(platform.monthlyCharge);
      const needsCurrency = platform.currency !== normalizedCurrency;

      if (!needsMonthlyCharge && !needsCurrency) {
        return platform;
      }

      configChanged = true;
      return {
        ...platform,
        monthlyCharge: needsMonthlyCharge ? 0 : platform.monthlyCharge,
        currency: normalizedCurrency,
      };
    });

    if (configChanged) {
      writePlatformConfig(updatedPlatforms);
    }

    const refreshedBySource = new Map(
      updatedPlatforms.map((platform) => [platform.url, platform])
    );
    const now = new Date();
    const ops = [];

    totals.forEach((platformTotal, platformIndex) => {
      const platform =
        refreshedBySource.get(platformTotal._id) ||
        configuredBySource.get(platformTotal._id) || {
          name: platformTotal.name || platformTotal._id,
          url: platformTotal._id,
          monthlyCharge: 0,
          currency: normalizeCurrency(),
        };

      for (let offset = MONTHS_TO_SEED - 1; offset >= 0; offset -= 1) {
        const pointIndex = MONTHS_TO_SEED - 1 - offset;
        const historicalFactor = getHistoricalFactor(
          platformIndex,
          pointIndex,
          MONTHS_TO_SEED
        );
        const monthlySpikeFactor = getMonthlySpikeFactor(
          platformIndex,
          pointIndex,
          MONTHS_TO_SEED
        );
        const factor = Math.max(
          0.35,
          historicalFactor * monthlySpikeFactor
        );
        const totalBytes =
          offset === 0
            ? Number(platformTotal.totalBytes || 0)
            : Math.round(Number(platformTotal.totalBytes || 0) * factor);
        const financial = calculateFinancialMetrics(totalBytes, platform);
        const month = buildMonthKeyFromOffset(offset);

        ops.push({
          updateOne: {
            filter: {
              moodle_source: platformTotal._id,
              month,
            },
            update: {
              $set: {
                moodle_source: platformTotal._id,
                moodle_name: platform.name || platformTotal.name || platformTotal._id,
                month,
                total_bytes: financial.totalBytes,
                monthly_charge: financial.monthlyCharge,
                cost_per_gb: financial.costPerGb,
                currency: financial.currency,
                income: financial.income,
                cost: financial.cost,
                margin: financial.margin,
                synced_at: now,
              },
            },
            upsert: true,
          },
        });
      }
    });

    if (ops.length) {
      await PlatformSnapshot.bulkWrite(ops, { ordered: false });
    }

    const snapshotsCount = await PlatformSnapshot.countDocuments();
    console.log(
      JSON.stringify(
        {
          platformsSeeded: totals.length,
          monthsSeededPerPlatform: MONTHS_TO_SEED,
          snapshotsCount,
          configChanged,
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
