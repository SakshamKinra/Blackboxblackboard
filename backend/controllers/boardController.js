// ============================================================
// controllers/boardController.js
// Business logic for all board API endpoints.
// Kept separate from route definitions for clean architecture.
// ============================================================

const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');
const Board = require('../models/Board');
const { uploadsDir } = require('../middleware/upload');

// Utility to delete images from disk
const deleteImages = (imagesArray) => {
  if (!imagesArray || imagesArray.length === 0) return;
  imagesArray.forEach(imageUrl => {
    try {
      const fileName = imageUrl.split('/uploads/')[1];
      if (fileName) {
        const filePath = path.join(uploadsDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error(`[Storage Guard] Failed to delete image ${imageUrl}:`, err.message);
    }
  });
};

// Evaluates expiry from activation timestamp + ttl hours.
const hasBoardExpired = (board) => {
  if (!board || !board.activatedAt) return false;
  const expiryTime = new Date(board.activatedAt).getTime() + board.expiresAfter * 60 * 60 * 1000;
  return Date.now() > expiryTime;
};

// Number of bcrypt salt rounds — 10 is the standard balance
// between security and performance.
const SALT_ROUNDS = 10;

// ------------------------------------------------------------
// createBoard  →  POST /api/boards
// Creates a new board with the specified lock configuration.
// ------------------------------------------------------------
const createBoard = async (req, res, next) => {
  try {
    const { content, unlockType, unlockAt, password, boardName, expiresAfter } = req.body;

    // Validate that unlockType is provided and is a valid enum value.
    const validTypes = ['date', 'password', 'both'];
    if (!unlockType || !validTypes.includes(unlockType)) {
      return res.status(400).json({
        success: false,
        message: `unlockType must be one of: ${validTypes.join(', ')}`,
      });
    }

    // For date or both types, unlockAt is mandatory.
    if ((unlockType === 'date' || unlockType === 'both') && !unlockAt) {
      return res.status(400).json({
        success: false,
        message: 'unlockAt date is required for date and both unlock types',
      });
    }

    // For password or both types, a password is mandatory.
    if ((unlockType === 'password' || unlockType === 'both') && !password) {
      return res.status(400).json({
        success: false,
        message: 'password is required for password and both unlock types',
      });
    }

    // Hash the password if it was provided.
    // bcrypt.hash is async and automatically generates a salt.
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Generate a short, URL-safe, collision-resistant board ID
    // using nanoid (21 chars by default, ~2 billion IDs before collision risk).
    const boardId = nanoid(10);

    // Validate expiresAfter if provided (1–48 hours)
    let validExpiresAfter = 3; // default
    if (expiresAfter !== undefined && expiresAfter !== null && expiresAfter !== '') {
      const parsed = Number(expiresAfter);
      if (isNaN(parsed) || parsed < 1 || parsed > 48) {
        return res.status(400).json({
          success: false,
          message: 'expiresAfter must be between 1 and 48 hours.',
        });
      }
      validExpiresAfter = parsed;
    }

    // Process any attached images uploaded via multer
    let attachedImages = [];
    if (req.files && req.files.length > 0) {
      attachedImages = req.files.map(file => `/uploads/${file.filename}`);
    }

    // ── Storage Guard ─────────────────────────────────────────
    // If total boards > 500, delete the 100 oldest.
    const totalBoards = await Board.countDocuments();
    if (totalBoards >= 500) {
      const oldestBoards = await Board.find().sort({ createdAt: 1 }).limit(100);
      let deletedOldCount = 0;
      for (const oldBoard of oldestBoards) {
        deleteImages(oldBoard.attachedImages);
        deleteImages(oldBoard.images);
        await Board.deleteOne({ _id: oldBoard._id });
        deletedOldCount++;
      }
      console.log(`[Storage Guard] Cleaned ${deletedOldCount} old boards`);
    }

    // ── Seed Whiteboard Data with Attached Images ──────────────
    // If images were attached during creation, we place them on the
    // whiteboard layer immediately so they are interactive.
    const seededWhiteboardImages = attachedImages.map((src, index) => ({
      id: `attached-${Date.now()}-${index}`,
      type: 'image',
      src: src,
      x: 50 + (index * 40),
      y: 50 + (index * 40),
      width: 300,
      height: 200,
      userName: 'System'
    }));

    // Persist the board document in MongoDB.
    const board = await Board.create({
      boardId,
      boardName: boardName || 'Untitled Board',
      content: content || '',
      unlockType,
      unlockAt: unlockAt ? new Date(unlockAt) : null,
      passwordHash,
      expiresAfter: validExpiresAfter,
      attachedImages,
      whiteboardData: seededWhiteboardImages,
    });

    // Build a shareable link using the CLIENT_URL from environment.
    const shareableLink = `${process.env.CLIENT_URL}/board/${board.boardId}`;

    // Return the board ID and shareable link — never the hash.
    return res.status(201).json({
      success: true,
      message: 'Board created successfully',
      boardId: board.boardId,
      shareableLink,
    });
  } catch (err) {
    // Forward unexpected errors to the global error handler.
    next(err);
  }
};

// ------------------------------------------------------------
// getBoardStatus  →  GET /api/boards/:id
// Returns board metadata so the frontend can render the
// appropriate locked UI.  Content and passwordHash are NEVER
// included in this response.
// ------------------------------------------------------------
const getBoardStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find board by boardId (the nanoid string, not MongoDB _id).
    const board = await Board.findOne({ boardId: id });

    if (!board) {
      return res.status(404).json({ success: false, message: 'Board not found' });
    }

    // Check if board has expired
    if (hasBoardExpired(board) && !board.isExpired) {
      board.isExpired = true;
      await board.save();
    }

    // Return only safe metadata — no content, no passwordHash.
    return res.status(200).json({
      success: true,
      boardId: board.boardId,
      boardName: board.boardName,
      unlockType: board.unlockType,
      unlockAt: board.unlockAt,   // null for password-only boards
      createdAt: board.createdAt,
      activatedAt: board.activatedAt,
      expiresAfter: board.expiresAfter,
      isExpired: board.isExpired,
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
// unlockBoard  →  POST /api/boards/:id/unlock
// Validates unlock conditions ENTIRELY server-side.
// If all conditions pass, the full board content is returned.
// ------------------------------------------------------------
const unlockBoard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body; // password is optional

    const board = await Board.findOne({ boardId: id });

    if (!board) {
      return res.status(404).json({ success: false, message: 'Board not found' });
    }

    // ── Check expiration ────────────────────────────────────
    // Recompute expiry here as well so direct unlock API calls
    // cannot bypass expiration before another endpoint updates isExpired.
    if (!board.isExpired && hasBoardExpired(board)) {
      board.isExpired = true;
      await board.save();
    }
    if (board.isExpired) {
      return res.status(410).json({
        success: false,
        message: 'This board has expired.',
        isExpired: true,
      });
    }

    // ── Date check ──────────────────────────────────────────
    // Use the SERVER clock — never trust the client timestamp.
    if (board.unlockType === 'date' || board.unlockType === 'both') {
      const now = new Date(); // server-side UTC timestamp
      if (now < board.unlockAt) {
        return res.status(403).json({
          success: false,
          locked: true,
          reason: 'date',
          message: 'Board is not unlocked yet',
          unlockAt: board.unlockAt,
        });
      }
    }

    // ── Password check ───────────────────────────────────────
    // bcrypt.compare safely handles timing-attack resistance.
    if (board.unlockType === 'password' || board.unlockType === 'both') {
      if (!password) {
        return res.status(400).json({
          success: false,
          locked: true,
          reason: 'password',
          message: 'Password is required to unlock this board',
        });
      }

      const isMatch = await bcrypt.compare(password, board.passwordHash);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          locked: true,
          reason: 'password',
          message: 'Incorrect password',
        });
      }
    }

    // ── Set activatedAt on FIRST unlock ──────────────────────
    if (!board.activatedAt) {
      board.activatedAt = new Date();
      await board.save();
    }

    // ── All conditions met — return full content ─────────────
    return res.status(200).json({
      success: true,
      locked: false,
      boardId: board.boardId,
      boardName: board.boardName,
      content: board.content,
      unlockType: board.unlockType,
      createdAt: board.createdAt,
      activatedAt: board.activatedAt,
      expiresAfter: board.expiresAfter,
      attachedImages: board.attachedImages,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBoard, getBoardStatus, unlockBoard };
