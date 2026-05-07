// ============================================================
// routes/adminRoutes.js
// Admin route definitions. Mounted at /api/admin in server.js.
// ============================================================

const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const { 
  adminLogin, 
  getAllBoards, 
  getAllWhiteboards,
  deleteExpiredBoards, 
  deleteOldBoards, 
  deleteExpiredWhiteboards,
  deleteAllBoards 
} = require('../controllers/adminController');

// POST /api/admin/login — public (no auth required)
router.post('/login', adminLogin);

// GET endpoints — protected (requires valid JWT)
router.get('/boards', adminAuth, getAllBoards);
router.get('/whiteboards', adminAuth, getAllWhiteboards);

// DELETE endpoints
router.delete('/boards/expired', adminAuth, deleteExpiredBoards);
router.delete('/boards/old', adminAuth, deleteOldBoards);
router.delete('/whiteboards/expired', adminAuth, deleteExpiredWhiteboards);
router.delete('/boards/all', adminAuth, deleteAllBoards);

module.exports = router;
