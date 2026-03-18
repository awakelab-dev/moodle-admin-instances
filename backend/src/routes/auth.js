const express = require('express');
const { findAuthUser, hashPassword, sanitizeUser } = require('../config/authUsers');
const { TOKEN_TTL_HOURS, createAuthToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const user = findAuthUser(username);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  const publicUser = sanitizeUser(user);

  res.json({
    token: createAuthToken(user),
    user: publicUser,
    expiresInHours: TOKEN_TTL_HOURS,
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
