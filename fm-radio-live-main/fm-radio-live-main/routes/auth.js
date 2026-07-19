const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { JWT_SECRET, verifyToken } = require('../middleware/auth');
const { isSessionAlive, touchSession, removeSession } = require('../session-store');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, displayName, location } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const db = await getDb();

    const existing = db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
      "INSERT INTO users (username, email, password, display_name, location, role) VALUES (?, ?, ?, ?, ?, 'broadcaster')",
      [username, email, hashedPassword, displayName || username, location || '']
    );

    const userId = db.lastInsertRowid();

    const token = jwt.sign(
      { id: userId, username, role: 'broadcaster' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
    res.json({ success: true, token, user: { id: userId, username, role: 'broadcaster' } });
  } catch (error) {
    console.error('Signup error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = await getDb();
    const user = db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    if (user.role !== 'admin' && isSessionAlive(String(user.id))) {
      return res.status(409).json({ error: 'Already logged in from another browser. Close that session first.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (user.role !== 'admin') {
      touchSession(String(user.id), token);
    }

    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'admin') {
        removeSession(String(decoded.id));
      }
    } catch (_) {}
  }
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const user = db.get('SELECT id, username, email, display_name, location, role, is_live FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role !== 'admin') {
      touchSession(String(user.id), req.token);
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
