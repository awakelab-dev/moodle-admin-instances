const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null },
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running',
  },
  platforms_total: { type: Number, default: 0 },
  platforms_synced: { type: Number, default: 0 },
  current_platform: { type: String, default: '' },
  sync_errors: [{ type: String }],
});

module.exports = mongoose.model('SyncLog', syncLogSchema);
