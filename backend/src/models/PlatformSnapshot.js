const mongoose = require('mongoose');

const platformSnapshotSchema = new mongoose.Schema(
  {
    moodle_source: { type: String, required: true },
    moodle_name: { type: String, required: true },
    month: { type: String, required: true },
    total_bytes: { type: Number, default: 0 },
    monthly_charge: { type: Number, default: null },
    cost_per_gb: { type: Number, default: null },
    currency: { type: String, default: 'CLP' },
    income: { type: Number, default: null },
    cost: { type: Number, default: null },
    margin: { type: Number, default: null },
    synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

platformSnapshotSchema.index({ moodle_source: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('PlatformSnapshot', platformSnapshotSchema);
