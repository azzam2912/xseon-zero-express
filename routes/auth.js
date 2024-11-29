const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Check if user exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with UUID
    const userId = uuidv4();
    const newUser = await pool.query(
      'INSERT INTO users (id, username, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, created_at',
      [userId, username, email, hashedPassword, role || 'user']
    );

    // Create token
    const token = jwt.sign(
      { 
        id: newUser.rows[0].id, 
        role: newUser.rows[0].role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username,
        email: newUser.rows[0].email,
        role: newUser.rows[0].role,
        created_at: newUser.rows[0].created_at
      },
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { 
        id: user.rows[0].id, 
        role: user.rows[0].role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Logged in successfully',
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        email: user.rows[0].email,
        role: user.rows[0].role,
        created_at: user.rows[0].created_at
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.rows[0]);
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// Update user
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.id;

    // Check if new username or email already exists
    if (username || email) {
      const existing = await pool.query(
        'SELECT * FROM users WHERE (email = $1 OR username = $2) AND id != $3',
        [email, username, userId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }
    }

    // Build update query dynamically
    let updateFields = [];
    let values = [];
    let valueCount = 1;

    if (username) {
      updateFields.push(`username = $${valueCount}`);
      values.push(username);
      valueCount++;
    }
    if (email) {
      updateFields.push(`email = $${valueCount}`);
      values.push(email);
      valueCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(userId);
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${valueCount}
      RETURNING id, username, email, role, created_at, updated_at
    `;

    const updatedUser = await pool.query(updateQuery, values);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser.rows[0]
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

module.exports = router;