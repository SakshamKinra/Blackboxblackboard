// ============================================================
// routes/adminRoutes.js
// Admin route definitions. Mounted at /api/admin in server.js.
// ============================================================

const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const { adminLogin, getAllBoards, deleteExpiredBoards, deleteOldBoards, deleteAllBoards } = require('../controllers/adminController');

// POST /api/admin/login — public (no auth required)
router.post('/login', adminLogin);

// GET /api/admin/boards — protected (requires valid JWT)
router.get('/boards', adminAuth, getAllBoards);

// DELETE endpoints
router.delete('/boards/expired', adminAuth, deleteExpiredBoards);
router.delete('/boards/old', adminAuth, deleteOldBoards);
router.delete('/boards/all', adminAuth, deleteAllBoards);

module.exports = router;
