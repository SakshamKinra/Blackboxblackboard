// ============================================================
// controllers/adminController.js
// Business logic for admin endpoints.
// Login validates against environment variables (not a DB user),
// and getAllBoards returns every board for the admin dashboard.
// ============================================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const Board = require('../models/Board');
const Whiteboard = require('../models/Whiteboard');

let adminPasswordHash = null;

// Utility to delete images from disk
const deleteImages = (imagesArray) => {
  if (!imagesArray || imagesArray.length === 0) return;
  imagesArray.forEach(imageUrl => {
    try {
      const fileName = imageUrl.split('/uploads/')[1];
      if (fileName) {
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error(`[Admin Cleanup] Failed to delete image ${imageUrl}:`, err.message);
    }
  });
};

// ------------------------------------------------------------
// adminLogin  →  POST /api/admin/login
// Validates email + password against .env credentials.
// On success, returns a signed JWT token (24h expiry).
// ------------------------------------------------------------
const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('[Admin] ADMIN_EMAIL or ADMIN_PASSWORD not set in .env');
      return res.status(500).json({
        success: false,
        message: 'Admin credentials not configured on server.',
      });
    }

    if (email !== adminEmail) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!adminPasswordHash) {
      adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    }

    const isMatch = await bcrypt.compare(password, adminPasswordHash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Sign a JWT with a 24-hour expiry
    const token = jwt.sign(
      { email: adminEmail, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
// getAllBoards  →  GET /api/admin/boards
// Returns ALL boards with relevant metadata for the dashboard.
// Protected by adminAuth middleware.
// ------------------------------------------------------------
const getAllBoards = async (req, res, next) => {
  try {
    const boards = await Board.find()
      .select('-_id boardId boardName unlockType createdAt activatedAt expiresAfter isExpired')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: boards.length,
      boards,
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
// deleteExpiredBoards → DELETE /api/admin/boards/expired
// ------------------------------------------------------------
const deleteExpiredBoards = async (req, res, next) => {
  try {
    const expiredBoards = await Board.find({ isExpired: true });
    let deleteCount = 0;

    for (const board of expiredBoards) {
      deleteImages(board.attachedImages);
      deleteImages(board.images);
      await Board.deleteOne({ _id: board._id });
      deleteCount++;
    }

    return res.status(200).json({ success: true, message: `Deleted ${deleteCount} expired boards.` });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
// deleteOldBoards → DELETE /api/admin/boards/old
// ------------------------------------------------------------
const deleteOldBoards = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldBoards = await Board.find({
      activatedAt: null,
      createdAt: { $lt: sevenDaysAgo }
    });
    
    let deleteCount = 0;

    for (const board of oldBoards) {
      deleteImages(board.attachedImages);
      deleteImages(board.images);
      await Board.deleteOne({ _id: board._id });
      deleteCount++;
    }

    return res.status(200).json({ success: true, message: `Deleted ${deleteCount} old unactivated boards.` });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
// deleteAllBoards → DELETE /api/admin/boards/all
// ------------------------------------------------------------
const deleteAllBoards = async (req, res, next) => {
  try {
    const allBoards = await Board.find();
    for (const board of allBoards) {
      deleteImages(board.attachedImages);
      deleteImages(board.images);
    }
    await Board.deleteMany({});
    
    const allWhiteboards = await Whiteboard.find();
    for (const wb of allWhiteboards) {
      if (wb.images && wb.images.length > 0) {
         wb.images.forEach(img => {
            if (img && img.src && img.src.includes('/uploads/')) {
               deleteImages([img.src]);
            }
         });
      }
    }
    await Whiteboard.deleteMany({});

    return res.status(200).json({ success: true, message: 'Nuked all boards and whiteboards.' });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
// getAllWhiteboards  →  GET /api/admin/whiteboards
// ------------------------------------------------------------
const getAllWhiteboards = async (req, res, next) => {
  try {
    const whiteboards = await Whiteboard.find()
      .select('-_id whiteboardId title createdAt expiresAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: whiteboards.length,
      whiteboards,
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
// deleteExpiredWhiteboards → DELETE /api/admin/whiteboards/expired
// ------------------------------------------------------------
const deleteExpiredWhiteboards = async (req, res, next) => {
  try {
    const now = new Date();
    const expiredWbs = await Whiteboard.find({ expiresAt: { $lt: now } });
    let deleteCount = 0;

    for (const wb of expiredWbs) {
      if (wb.images && wb.images.length > 0) {
        wb.images.forEach(img => {
          if (img && img.src && img.src.includes('/uploads/')) {
            deleteImages([img.src]);
          }
        });
      }
      await Whiteboard.deleteOne({ _id: wb._id });
      deleteCount++;
    }

    return res.status(200).json({ success: true, message: `Deleted ${deleteCount} expired whiteboards.` });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  adminLogin, 
  getAllBoards, 
  getAllWhiteboards,
  deleteExpiredBoards, 
  deleteOldBoards, 
  deleteExpiredWhiteboards,
  deleteAllBoards 
};
