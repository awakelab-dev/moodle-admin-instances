const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    moodle_source: { type: String, required: true },
    moodle_name: { type: String, required: true },
    user_id: { type: Number, required: true },
    username: { type: String, required: true },
    fullname: { type: String, default: '' },
    total_size_bytes: { type: Number, default: 0 },
    synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.index({ moodle_source: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
