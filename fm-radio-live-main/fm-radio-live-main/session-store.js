const activeSessions = new Map();
const SESSION_TIMEOUT = 300000;

function isSessionAlive(userId) {
  const session = activeSessions.get(userId);
  if (!session) return false;
  if (Date.now() - session.lastSeen > SESSION_TIMEOUT) {
    activeSessions.delete(userId);
    return false;
  }
  return true;
}

function touchSession(userId, token) {
  const existing = activeSessions.get(userId);
  if (existing && existing.token !== token) return false;
  activeSessions.set(userId, { token, loginTime: Date.now(), lastSeen: Date.now() });
  return true;
}

function removeSession(userId) {
  activeSessions.delete(userId);
}

module.exports = { isSessionAlive, touchSession, removeSession };
