const express = require('express');
const router = express.Router();
const { runFullSync, getProgress } = require('../services/syncService');
const SyncLog = require('../models/SyncLog');

let syncRunning = false;

/** POST /api/sync – Trigger a full sync across all platforms */
router.post('/', async (_req, res) => {
  if (syncRunning) {
    return res.status(409).json({
      error: 'Una sincronización ya está en curso.',
      progress: getProgress(),
    });
  }

  syncRunning = true;
  res.json({ message: 'Sincronización iniciada', progress: getProgress() });

  // Run sync in the background (don't await in request handler)
  try {
    await runFullSync();
  } finally {
    syncRunning = false;
  }
});

/** GET /api/sync/status – Poll current sync progress */
router.get('/status', (_req, res) => {
  const progress = getProgress();
  if (!progress) {
    return res.json({ status: 'idle' });
  }
  res.json(progress);
});

/** GET /api/sync/last – Get the most recent completed sync log */
router.get('/last', async (_req, res) => {
  try {
    const last = await SyncLog.findOne({ status: 'completed' })
      .sort({ completed_at: -1 })
      .lean();
    res.json(last || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
