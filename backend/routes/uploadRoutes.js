// ============================================================
// routes/uploadRoutes.js
// Handles image file uploads for text boards using multer.
// Mounted at /api/boards in server.js alongside boardRoutes.
// ============================================================

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const Board = require('../models/Board');

// POST /api/boards/:id/upload — upload an image to a board
router.post('/:id/upload', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }

    const { id } = req.params;
    const board = await Board.findOne({ boardId: id });

    if (!board) {
      return res.status(404).json({ success: false, message: 'Board not found.' });
    }

    // Check if board has expired using centralized logic
    const { hasBoardExpired } = require('../controllers/boardController');
    if (hasBoardExpired(board) && !board.isExpired) {
      board.isExpired = true;
      await board.save();
    }
    if (board.isExpired) {
      return res.status(410).json({ success: false, message: 'Cannot upload to an expired board.' });
    }

    // Build the image URL using the server base URL
    const imageUrl = `/uploads/${req.file.filename}`;
    const image = {
      type: 'image',
      id: Date.now().toString(),
      src: imageUrl,
      x: 40,
      y: 40,
      width: 260,
      height: 180,
    };

    // Keep image URL for backward compatibility / cleanup jobs.
    board.images.push(imageUrl);
    // Source of truth for board whiteboard layer.
    board.whiteboardData.push(image);
    // Update lastAccessedAt to refresh inactivity window
    board.lastAccessedAt = new Date();
    await board.save();

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl,
      image,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
