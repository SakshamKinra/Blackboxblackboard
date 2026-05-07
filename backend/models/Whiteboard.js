const mongoose = require('mongoose');

const WhiteboardSchema = new mongoose.Schema({
  whiteboardId: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    default: 'Untitled Whiteboard',
  },
  strokes: {
    type: Array,
    default: [],
  },
  images: {
    type: Array,
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
  },
});

module.exports = mongoose.model('Whiteboard', WhiteboardSchema);
