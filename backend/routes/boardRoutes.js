// ============================================================
// routes/boardRoutes.js
// Declares URL patterns and maps them to controller functions.
// Mounted at /api/boards in server.js.
// ============================================================

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

const rateLimit = require('express-rate-limit');

const {
  createBoard,
  getBoardStatus,
  unlockBoard,
} = require('../controllers/boardController');

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Easy there! You can create 5 boards per hour.' }
});

// POST /api/boards
// Create a new board with lock configuration and optional attachments.
router.post('/', createLimiter, upload.array('images', 2), createBoard);

// GET /api/boards/:id
// Get board metadata (lock type, unlock date) — no content.
router.get('/:id', getBoardStatus);

// POST /api/boards/:id/unlock
// Attempt to unlock the board; validate server-side.
router.post('/:id/unlock', unlockBoard);

module.exports = router;
