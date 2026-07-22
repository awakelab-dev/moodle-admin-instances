const crypto = require('crypto');

const AUTH_ROLES = {
  ADMIN: 'admin',
  LIMITED: 'limited',
};

const AUTH_USERS = [
  {
    username: 'admin',
    displayName: 'Administrador',
    role: AUTH_ROLES.ADMIN,
    // Local dev password: Awakelab2026! (reset locally, never committed with the real prod hash)
    passwordHash: '1df92601c124b179b7afb62f86212b97043c60f0720bf157c35ee9544a9f05b1',
  },
  {
    username: 'consulta',
    displayName: 'Usuario consulta',
    role: AUTH_ROLES.LIMITED,
    passwordHash: '2d7694f6f4873c6b14268247b9cad7c1ed9ee902dfcda1916ea9756a78f0e4b9',
  },
];

function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

function hashPassword(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex');
}

function findAuthUser(username) {
  const normalizedUsername = normalizeUsername(username);

  return (
    AUTH_USERS.find(
      (user) => normalizeUsername(user.username) === normalizedUsername
    ) || null
  );
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

module.exports = {
  AUTH_ROLES,
  AUTH_USERS,
  findAuthUser,
  hashPassword,
  sanitizeUser,
};
