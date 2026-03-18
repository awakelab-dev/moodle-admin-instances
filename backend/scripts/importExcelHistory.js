/**
 * Import historical GB data from Excel into PlatformSnapshot collection.
 * Logs output to file for complete visibility.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const PlatformSnapshot = require('../src/models/PlatformSnapshot');
const {
  calculateFinancialMetrics,
  normalizeCurrency,
  readPlatformConfig,
} = require('../src/config/platformConfig');

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/moodle-admin-instances';

const EXCEL_PATH = 'C:\\Users\\Owner\\Downloads\\historial registro awk.xlsx';
const LOG_PATH = 'C:\\tmp\\import_log.txt';

function gbToBytes(gb) {
  return Math.round(Number(gb || 0) * Math.pow(1024, 3));
}

const MONTH_MAP = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
};

const log = [];
function logLine(msg) {
  log.push(msg);
  console.log(msg);
}

async function main() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const yearRow = rows[0];
  const monthRow = rows[1];

  const columns = [];
  for (let col = 4; col < monthRow.length; col++) {
    const monthName = String(monthRow[col] || '').toLowerCase().trim();
    const year = yearRow[col];
    const monthNum = MONTH_MAP[monthName];
    if (!monthNum || !year) continue;
    columns.push({ col, year: String(year), monthNum, monthKey: `${year}-${monthNum}` });
  }

  logLine(`Found ${columns.length} month columns: ${columns.map(c => c.monthKey).join(', ')}`);

  const platforms = readPlatformConfig();
  const platformBySubdomain = new Map();
  platforms.forEach(p => {
    try {
      const hostname = new URL(p.url).hostname;
      platformBySubdomain.set(hostname, p);
    } catch (e) {}
  });

  const now = new Date();
  const ops = [];
  let skipped = 0;
  let matched = 0;

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const urlSubdomain = String(row[0] || '').trim();
    const empresaGrupo = String(row[3] || '').trim();

    if (!urlSubdomain || empresaGrupo.toLowerCase() === 'total') continue;

    const platform = platformBySubdomain.get(urlSubdomain);
    const moodleSource = platform ? platform.url : `https://${urlSubdomain}`;
    const moodleName = platform ? platform.name : empresaGrupo || urlSubdomain;

    if (!platform) {
      logLine(`WARNING: No config for "${urlSubdomain}" -> using "https://${urlSubdomain}" / "${empresaGrupo}"`);
      skipped++;
    } else {
      logLine(`OK: "${urlSubdomain}" -> "${platform.name}" (${platform.url})`);
      matched++;
    }

    for (const { col, monthKey } of columns) {
      const gbValue = Number(row[col] || 0);
      if (gbValue <= 0) continue;

      const totalBytes = gbToBytes(gbValue);
      const financial = calculateFinancialMetrics(totalBytes, platform || {
        monthlyCharge: null,
        currency: normalizeCurrency(),
      });

      ops.push({
        updateOne: {
          filter: { moodle_source: moodleSource, month: monthKey },
          update: {
            $set: {
              moodle_source: moodleSource,
              moodle_name: moodleName,
              month: monthKey,
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
  }

  logLine('');
  logLine(`=== Summary ===`);
  logLine(`Platforms matched in config: ${matched}`);
  logLine(`Platforms NOT in config: ${skipped}`);
  logLine(`Total upsert operations: ${ops.length}`);

  if (!ops.length) {
    logLine('No operations to perform.');
    fs.writeFileSync(LOG_PATH, log.join('\n'), 'utf-8');
    return;
  }

  await mongoose.connect(MONGODB_URI);
  try {
    const result = await PlatformSnapshot.bulkWrite(ops, { ordered: false });
    logLine('');
    logLine(`=== Result ===`);
    logLine(`Matched: ${result.matchedCount}`);
    logLine(`Modified: ${result.modifiedCount}`);
    logLine(`Upserted: ${result.upsertedCount}`);

    const total = await PlatformSnapshot.countDocuments();
    logLine(`Total snapshots in DB: ${total}`);
  } finally {
    await mongoose.disconnect();
    fs.writeFileSync(LOG_PATH, log.join('\n'), 'utf-8');
  }
}

main().catch((err) => {
  logLine('ERROR: ' + err.message);
  fs.writeFileSync(LOG_PATH, log.join('\n'), 'utf-8');
  process.exitCode = 1;
});
