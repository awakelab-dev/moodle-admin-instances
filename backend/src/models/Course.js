const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    moodle_source: { type: String, required: true },
    moodle_name: { type: String, required: true },
    course_id: { type: Number, required: true },
    course_name: { type: String, required: true },
    shortname: { type: String, default: '' },
    category_id: { type: Number, required: true },
    category_name: { type: String, default: 'Sin categoría' },

    // Size breakdown
    size_bytes: { type: Number, default: 0 },             // Course content (materials)
    backup_size_bytes: { type: Number, default: 0 },      // Moodle backup component files
    assignment_size_bytes: { type: Number, default: 0 },  // Student submissions
    forum_size_bytes: { type: Number, default: 0 },       // Forum attachments
    storage_breakdown: [
      {
        _id: false,
        component: { type: String, default: '' },
        filearea: { type: String, default: '' },
        size_bytes: { type: Number, default: 0 },
      },
    ],
    detailed_storage_breakdown: [
      {
        _id: false,
        component: { type: String, default: '' },
        filearea: { type: String, default: '' },
        size_bytes: { type: Number, default: 0 },
      },
    ],
    detailed_size_bytes: { type: Number, default: 0 },
    detailed_backup_size_bytes: { type: Number, default: 0 },
    detailed_assignment_size_bytes: { type: Number, default: 0 },
    detailed_forum_size_bytes: { type: Number, default: 0 },
    detailed_total_bytes: { type: Number, default: 0 },
    detailed_calculated_at: { type: Date, default: null },

    synced_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

courseSchema.index({ moodle_source: 1, course_id: 1 }, { unique: true });

module.exports = mongoose.model('Course', courseSchema);
