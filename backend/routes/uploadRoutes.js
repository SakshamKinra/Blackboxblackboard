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

    // Build the image URL using the server base URL
    const imageUrl = `/uploads/${req.file.filename}`;

    // Save the image URL to the board's images array
    board.images.push(imageUrl);
    await board.save();

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
