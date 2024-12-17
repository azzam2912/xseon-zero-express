const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');

// Create quiz (admin only)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const quizResult = await client.query(
        'INSERT INTO quizzes (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
        [title, description, req.user.id]
      );
      
      await client.query(
        'INSERT INTO quiz_objects (quiz_id, questions_json) VALUES ($1, $2)',
        [quizResult.rows[0].id, JSON.stringify(questions)]
      );
      
      await client.query('COMMIT');
      res.status(201).json({ message: 'Quiz created', quizId: quizResult.rows[0].id });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Error creating quiz' });
  }
});

// Assign quiz to user (admin only)
router.post('/assign', verifyToken, async (req, res) => {
  try {
    const { userId, quizId } = req.body;
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await pool.query(
      'INSERT INTO quizzes_hub (auth_user_id, quiz_id) VALUES ($1, $2)',
      [userId, quizId]
    );
    
    res.status(201).json({ message: 'Quiz assigned successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error assigning quiz' });
  }
});

// Get assigned quizzes (user)
router.get('/assigned', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT qh.*, q.title, q.description 
       FROM quizzes_hub qh 
       JOIN quizzes q ON qh.quiz_id = q.id 
       WHERE qh.auth_user_id = $1`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching assigned quizzes' });
  }
});

// Submit quiz answers (user)
router.post('/:quizId/submit', verifyToken, async (req, res) => {
  try {
    const { answers } = req.body;
    const { quizId } = req.params;

    await pool.query(
      `UPDATE quizzes_hub 
       SET status = 'completed', 
           answers_json = $1,
           completed_at = CURRENT_TIMESTAMP
       WHERE quiz_id = $2 AND auth_user_id = $3`,
      [JSON.stringify(answers), quizId, req.user.id]
    );
    
    res.json({ message: 'Quiz submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting quiz' });
  }
});

module.exports = router;