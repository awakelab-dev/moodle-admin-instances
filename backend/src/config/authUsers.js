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
    passwordHash: '5ce41ada64f1e8ffb0acfaafa622b141438f3a5777785e7f0b830fb73e40d3d6',
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
