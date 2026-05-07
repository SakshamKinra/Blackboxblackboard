const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Whiteboard = require('../models/Whiteboard');

// POST /api/whiteboards — create new whiteboard
router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body;
    
    // Generate a unique 8-character ID for the whiteboard link
    const whiteboardId = crypto.randomBytes(4).toString('hex');
    
    const newWb = new Whiteboard({
      whiteboardId,
      title: title || 'Untitled Whiteboard'
    });
    
    await newWb.save();
    
    return res.status(201).json({
      success: true,
      message: 'Whiteboard created successfully',
      whiteboardId
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/whiteboards/:id — get whiteboard data
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const wb = await Whiteboard.findOne({ whiteboardId: id });
    if (!wb) {
      return res.status(404).json({ success: false, message: 'Whiteboard not found' });
    }
    
    // Check expiration
    if (Date.now() > new Date(wb.expiresAt).getTime()) {
      return res.status(403).json({ success: false, message: 'Whiteboard has expired' });
    }
    
    return res.status(200).json({
      success: true,
      whiteboard: {
        whiteboardId: wb.whiteboardId,
        title: wb.title,
        strokes: wb.strokes,
        images: wb.images,
        createdAt: wb.createdAt,
        expiresAt: wb.expiresAt
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
