// ============================================================
// routes/boardRoutes.js
// Declares URL patterns and maps them to controller functions.
// Mounted at /api/boards in server.js.
// ============================================================

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

const {
  createBoard,
  getBoardStatus,
  unlockBoard,
} = require('../controllers/boardController');

// POST /api/boards
// Create a new board with lock configuration and optional attachments.
router.post('/', upload.array('images', 2), createBoard);

// GET /api/boards/:id
// Get board metadata (lock type, unlock date) — no content.
router.get('/:id', getBoardStatus);

// POST /api/boards/:id/unlock
// Attempt to unlock the board; validate server-side.
router.post('/:id/unlock', unlockBoard);

module.exports = router;
