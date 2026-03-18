require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const syncRoutes = require('./routes/sync');
const dashboardRoutes = require('./routes/dashboard');
const platformRoutes = require('./routes/platforms');
const { AUTH_ROLES } = require('./config/authUsers');
const { requireAuth, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/moodle-admin-instances';

/* ─── Middleware ─── */
app.use(cors());
app.use(express.json());

/* ─── Routes ─── */
app.use('/api/auth', authRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', requireAuth);
app.use('/api/sync', requireRole(AUTH_ROLES.ADMIN), syncRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/platforms', platformRoutes);

/* ─── Start ─── */
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`✓ MongoDB connected: ${MONGODB_URI}`);

    app.listen(PORT, () => {
      console.log(`✓ Backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('✗ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
