const crypto = require('crypto');
const { findAuthUser, sanitizeUser } = require('../config/authUsers');

const AUTH_TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET || 'change-this-secret-before-production';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

function signPayload(value) {
  return crypto
    .createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(value)
    .digest('base64url');
}

function createAuthToken(user) {
  const payload = {
    ...sanitizeUser(user),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function parseAuthToken(token) {
  if (!token || typeof token !== 'string') return null;

  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload = null;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    );
  } catch {
    return null;
  }

  if (!payload?.username || !payload?.exp || payload.exp < Date.now()) {
    return null;
  }

  const user = findAuthUser(payload.username);

  if (!user) return null;

  const publicUser = sanitizeUser(user);

  if (publicUser.role !== payload.role) {
    return null;
  }

  return publicUser;
}

function getTokenFromRequest(req) {
  const authorization = req.header('authorization') || '';

  if (!authorization.startsWith('Bearer ')) return '';

  return authorization.slice('Bearer '.length).trim();
}

function requireAuth(req, res, next) {
  const user = parseAuthToken(getTokenFromRequest(req));

  if (!user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }

  req.user = user;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: 'No tienes permisos para esta acción.' });
    }

    next();
  };
}

module.exports = {
  TOKEN_TTL_HOURS: TOKEN_TTL_MS / (1000 * 60 * 60),
  createAuthToken,
  requireAuth,
  requireRole,
};
