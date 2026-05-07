// ============================================================
// controllers/boardController.js
// Business logic for all board API endpoints.
// Kept separate from route definitions for clean architecture.
// ============================================================

const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const Board = require('../models/Board');

// Number of bcrypt salt rounds — 10 is the standard balance
// between security and performance.
const SALT_ROUNDS = 10;

// ------------------------------------------------------------
// createBoard  →  POST /api/boards
// Creates a new board with the specified lock configuration.
// ------------------------------------------------------------
const createBoard = async (req, res, next) => {
  try {
    const { content, unlockType, unlockAt, password } = req.body;

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

    // Persist the board document in MongoDB.
    const board = await Board.create({
      boardId,
      content: content || '',
      unlockType,
      unlockAt: unlockAt ? new Date(unlockAt) : null,
      passwordHash,
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

    // Return only safe metadata — no content, no passwordHash.
    return res.status(200).json({
      success: true,
      boardId: board.boardId,
      unlockType: board.unlockType,
      unlockAt: board.unlockAt,   // null for password-only boards
      createdAt: board.createdAt,
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

    // ── All conditions met — return full content ─────────────
    return res.status(200).json({
      success: true,
      locked: false,
      boardId: board.boardId,
      content: board.content,
      unlockType: board.unlockType,
      createdAt: board.createdAt,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBoard, getBoardStatus, unlockBoard };
