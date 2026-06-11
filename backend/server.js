// ============================================================
// server.js
// Entry point for the BlackBoard backend.
// Sets up Express, MongoDB, Socket.io, CORS, and routes.
// ============================================================

// ── Load environment variables from .env FIRST ──────────────
require('dotenv').config();

const express = require('express');
const http = require('http');                 // Node's built-in HTTP module
const { Server } = require('socket.io');      // Socket.io v4 named export
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// ── Rate Limiting ───────────────────────────────────────────
// Brute-force protection for sensitive endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { success: false, message: 'Too many attempts, please try again after 15 minutes.' }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: { success: false, message: 'Too many requests, please slow down.' }
});

// Internal modules
const boardRoutes  = require('./routes/boardRoutes');
const adminRoutes  = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const whiteboardRoutes = require('./routes/whiteboardRoutes');
const errorHandler = require('./middleware/errorHandler');
const Board = require('./models/Board');
const { hasBoardExpired } = require('./controllers/boardController');
const path = require('path');
const fs = require('fs');
const { ensureUploadsDir, uploadsDir } = require('./middleware/upload');

// ── Express app & raw HTTP server ───────────────────────────
// Socket.io needs the raw http.Server instance, not the Express
// app directly, so we create it explicitly.
const app = express();
const httpServer = http.createServer(app);

// ── CORS configuration ──────────────────────────────────────
// Dynamic origin check — allows Vercel production and local dev.
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://blackboxblackboard.vercel.app',
      'http://localhost:3000'
    ];
    // Allow exact matches or undefined origin (for server-to-server/Postman)
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Socket.io setup ─────────────────────────────────────────
// Uses the same CORS config as Express.
const io = new Server(httpServer, {
  cors: corsOptions,
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Unauthorized'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.boardId) socket.data.boardId = decoded.boardId;
    if (decoded.whiteboardId) socket.data.whiteboardId = decoded.whiteboardId;
    next();
  } catch (err) {
    next(new Error('Unauthorized'));
  }
});
const boardParticipants = new Map();
const whiteboardParticipants = new Map();

const boardUsers = {}; // { boardId: { socketId: { userId, userName, color, userNumber } } }
const whiteboardUsers = {}; // { whiteboardId: { socketId: { userId, userName, color, userNumber } } }

const USER_COLORS = [
  '#C9A84C',  // gold
  '#ED93B1',  // blush pink
  '#AFA9EC',  // lavender
  '#6EC9A8',  // mint
  '#E8956D',  // coral
  '#64B5F6',  // sky blue
];

const socketRateLimits = new Map();

const checkSocketRateLimit = (socketId) => {
  const now = Date.now();
  let data = socketRateLimits.get(socketId) || { count: 0, lastReset: now };
  if (now - data.lastReset > 1000) {
    data.count = 1;
    data.lastReset = now;
  } else {
    data.count++;
  }
  socketRateLimits.set(socketId, data);
  return data.count <= 50;
};

const normalizeName = (value) => (typeof value === 'string' ? value.trim() : '');

const upsertParticipant = (store, roomId, socketId, name) => {
  if (!store.has(roomId)) store.set(roomId, new Map());
  store.get(roomId).set(socketId, name);
};

const removeParticipant = (store, roomId, socketId) => {
  if (!roomId || !store.has(roomId)) return null;
  const room = store.get(roomId);
  const name = room.get(socketId) || null;
  room.delete(socketId);
  if (room.size === 0) store.delete(roomId);
  return name;
};

const participantsList = (store, roomId) => {
  if (!roomId || !store.has(roomId)) return [];
  return Array.from(store.get(roomId).values());
};

// ── Body parsing ─────────────────────────────────────────────
// Parse incoming JSON request bodies (required for POST routes).
app.use(express.json());
// Parse URL-encoded bodies (e.g., from HTML forms).
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists on boot in all environments.
console.log(`[Startup] Uploads directory set to: ${uploadsDir}`);
ensureUploadsDir();

// ── Health-check route ───────────────────────────────────────
// A simple GET / endpoint to confirm the server is alive.
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BlackBoard API is running 🟢' });
});

// ── Static file serving for uploads ─────────────────────────
app.use('/uploads', express.static(uploadsDir));

// ── API Routes ───────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/boards/:id/unlock', authLimiter);
app.use('/api/admin/login', authLimiter);

// All board-related REST endpoints are mounted under /api/boards.
app.use('/api/boards', boardRoutes);

// Upload routes (image upload for boards) — also under /api/boards.
app.use('/api/boards', uploadRoutes);

// Admin routes mounted under /api/admin.
app.use('/api/admin', adminRoutes);

app.use('/api/whiteboards', whiteboardRoutes);

// ── 404 handler — unknown routes ────────────────────────────
// Catches any request that didn't match a registered route.
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────
// MUST be after all routes and other middleware.
// Catches errors forwarded via next(err) from controllers.
app.use(errorHandler);

// ── Debounced DB Persistence ────────────────────────────────
const pendingTextUpdates = new Map(); // boardId -> content
const pendingStrokes = new Map();     // boardId -> array of strokes
const pendingWbStrokes = new Map();   // whiteboardId -> array of strokes

setInterval(async () => {
  // Sync text updates
  if (pendingTextUpdates.size > 0) {
    const updates = new Map(pendingTextUpdates);
    pendingTextUpdates.clear();
    for (const [boardId, content] of updates.entries()) {
      try {
        await Board.updateOne({ boardId }, { content });
      } catch (err) {
        console.error(`[DB Sync] Error saving board ${boardId}:`, err.message);
      }
    }
  }

  // Sync board strokes
  if (pendingStrokes.size > 0) {
    const updates = new Map(pendingStrokes);
    pendingStrokes.clear();
    for (const [boardId, strokes] of updates.entries()) {
      try {
        const board = await Board.findOne({ boardId }, { whiteboardData: 1 });
        if (board && Array.isArray(board.whiteboardData) && board.whiteboardData.length > 3000) {
          // Limit reached: clear strokes but keep images
          const images = board.whiteboardData.filter(item => item && item.type === 'image');
          await Board.updateOne({ boardId }, { $set: { whiteboardData: [...images, ...strokes] } });
        } else {
          await Board.updateOne({ boardId }, { $push: { whiteboardData: { $each: strokes } } });
        }
      } catch (err) {
        console.error(`[DB Sync] Error saving strokes for ${boardId}:`, err.message);
      }
    }
  }

  // Sync standalone whiteboard strokes
  if (pendingWbStrokes.size > 0) {
    const Whiteboard = require('./models/Whiteboard');
    const updates = new Map(pendingWbStrokes);
    pendingWbStrokes.clear();
    for (const [whiteboardId, strokes] of updates.entries()) {
      try {
        const wb = await Whiteboard.findOne({ whiteboardId }, { strokes: 1 });
        if (wb && Array.isArray(wb.strokes) && wb.strokes.length > 3000) {
          await Whiteboard.updateOne({ whiteboardId }, { $set: { strokes: strokes } });
        } else {
          await Whiteboard.updateOne({ whiteboardId }, { $push: { strokes: { $each: strokes } } });
        }
      } catch (err) {
        console.error(`[DB Sync] Error saving standalone strokes for ${whiteboardId}:`, err.message);
      }
    }
  }
}, 2000); // Save every 2 seconds


// ── Socket.io — Real-time collaboration ─────────────────────
// Each board gets its own Socket.io room identified by boardId.
// Only clients that have successfully unlocked a board will
// join that room (enforced by the frontend after /unlock call).
io.on('connection', (socket) => {
  // console.log(`[Socket.io] Client connected: ${socket.id}`);

  // ── Event: join_board ──────────────────────────────────────
  // Called by the frontend after a board is unlocked.
  // The client joins the room so it can send/receive updates.
  //
  // Payload: { userName: string, userId: string }
  socket.on('join_board', async ({ userName, userId }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const normalizedName = normalizeName(userName);
    if (!normalizedName) {
      socket.emit('join_error', { message: 'Display name is required.' });
      return;
    }

    socket.join(boardId); // join the room named after the boardId
    socket.data.boardId = boardId;
    socket.data.boardUserName = normalizedName;
    upsertParticipant(boardParticipants, boardId, socket.id, normalizedName);
    // console.log(`[Socket.io] Socket ${socket.id} joined room: ${boardId}`);

    if (!boardUsers[boardId]) boardUsers[boardId] = {};
    const existingCount = Object.keys(boardUsers[boardId]).length;
    const color = USER_COLORS[existingCount % USER_COLORS.length];
    const userNumber = existingCount + 1;
    const assignedUserId = userId || socket.id;
    boardUsers[boardId][socket.id] = { userId: assignedUserId, userName: normalizedName, color, userNumber };

    // Acknowledge the join to the connecting client only.
    socket.emit('joined_board', { boardId, message: 'Joined board room', color, userNumber, userId: assignedUserId, userName: normalizedName });
    socket.to(boardId).emit('user_joined', { userName: normalizedName });
    io.to(boardId).emit('room_users', { users: participantsList(boardParticipants, boardId) });
    io.to(boardId).emit('user_list', { users: Object.values(boardUsers[boardId]) });

    try {
      // Send existing whiteboard data to the newly joined user
      const board = await Board.findOne({ boardId });
      if (board && board.whiteboardData && board.whiteboardData.length > 0) {
        socket.emit('whiteboard_data', board.whiteboardData);
      }
      // mark activity for this board (joined/viewed)
      try { Board.updateOne({ boardId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {}); } catch (e) {}
    } catch (err) {
      console.error(`[Socket.io] Error fetching whiteboard data for board ${boardId}:`, err.message);
    }
  });

  // ── Event: text_update ────────────────────────────────────
  // Sent by a client when the board content changes.
  // The server:
  //   1. Persists the new content to MongoDB.
  //   2. Broadcasts it to ALL OTHER clients in the same room.
  //
  // Payload: { content: string }
  socket.on('text_update', async ({ content, userName }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const author = normalizeName(userName) || socket.data.boardUserName || 'Anonymous';

    // Queue update for batch DB save
    pendingTextUpdates.set(boardId, content);
    // Refresh lastAccessedAt for activity
    Board.updateOne({ boardId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {});

    // Broadcast to every OTHER socket in the room immediately.
    socket.to(boardId).emit('receive_update', { boardId, content });
    socket.to(boardId).emit('text_update_author', {
      boardId,
      content,
      userName: author,
      timestamp: Date.now(),
    });
  });

  socket.on('text_typing', ({ userName }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const author = normalizeName(userName) || socket.data.boardUserName || 'Anonymous';
    socket.to(boardId).emit('text_typing', { boardId, userName: author, timestamp: Date.now() });
  });

  // ── Event: image_added ──────────────────────────────────
  socket.on('image_added', async ({ content, imageUrl, userName }) => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    const author = normalizeName(userName) || socket.data.boardUserName || 'Anonymous';
    socket.to(boardId).emit('image_added', { boardId, content, imageUrl, userName: author });
    console.log(`[Socket.io] Image added to board: ${boardId}`);
    // mark activity
    Board.updateOne({ boardId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {});
  });

  // ── Event: draw_sync ──────────────────────────────────────
  socket.on('draw_sync', ({ stroke }) => {
    if (!checkSocketRateLimit(socket.id)) return;
    const boardId = socket.data.boardId;
    if (!boardId || !stroke) return;
    socket.to(boardId).emit('receive_sync_stroke', stroke);
  });

  // ── Event: draw_stroke ────────────────────────────────────
  socket.on('draw_stroke', async ({ stroke }) => {
    if (!checkSocketRateLimit(socket.id)) return;
    const boardId = socket.data.boardId;
    if (!boardId || !stroke) return;
    if (!pendingStrokes.has(boardId)) pendingStrokes.set(boardId, []);
    pendingStrokes.get(boardId).push(stroke);
    socket.to(boardId).emit('receive_stroke', stroke);
    // mark activity
    Board.updateOne({ boardId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {});
  });

  socket.on('draw_undo', async () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    try {
      await Board.updateOne({ boardId }, { $pop: { whiteboardData: 1 } });
      socket.to(boardId).emit('receive_undo');
    } catch (err) {
      console.error('[Socket.io] Error undoing board stroke:', err.message);
    }
  });

  // ── Event: clear_whiteboard ────────────────────────────────
  socket.on('clear_whiteboard', async () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;
    try {
      await Board.updateOne({ boardId }, { $set: { whiteboardData: [] } });
      socket.to(boardId).emit('clear_whiteboard');
    } catch (err) {
      console.error(`[Socket.io] Error clearing whiteboard:`, err.message);
    }
  });

  // ── Event: whiteboard_image_added ──────────────────────────
  socket.on('whiteboard_image_added', async ({ image }) => {
    const boardId = socket.data.boardId;
    if (!boardId || !image) return;
    try {
      const board = await Board.findOne({ boardId });
      if (!board) return;
      const data = Array.isArray(board.whiteboardData) ? board.whiteboardData : [];
      const exists = data.some(item => item && item.type === 'image' && item.id === image.id);
      if (!exists) {
        board.whiteboardData = [...data, image];
        await board.save();
      }
      socket.to(boardId).emit('whiteboard_image_added', image);
      // mark activity
      Board.updateOne({ boardId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {});
    } catch (err) {
      console.error(`[Socket.io] Error saving whiteboard image:`, err.message);
    }
  });

  socket.on('whiteboard_image_updated', async ({ image }) => {
    const boardId = socket.data.boardId;
    if (!boardId || !image || !image.id) return;
    try {
      const board = await Board.findOne({ boardId });
      if (!board) return;
      const data = Array.isArray(board.whiteboardData) ? board.whiteboardData : [];
      board.whiteboardData = data.map(item => (
        item && item.type === 'image' && item.id === image.id ? { ...item, ...image } : item
      ));
      await board.save();
      socket.to(boardId).emit('whiteboard_image_updated', image);
      Board.updateOne({ boardId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {});
    } catch (err) {
      console.error('[Socket.io] Error updating whiteboard image:', err.message);
    }
  });

  socket.on('whiteboard_image_removed', async ({ imageId }) => {
    const boardId = socket.data.boardId;
    if (!boardId || !imageId) return;
    try {
      const board = await Board.findOne({ boardId });
      if (!board) return;
      const data = Array.isArray(board.whiteboardData) ? board.whiteboardData : [];
      board.whiteboardData = data.filter(item => !(item && item.type === 'image' && item.id === imageId));
      await board.save();
      socket.to(boardId).emit('whiteboard_image_removed', { imageId });
      Board.updateOne({ boardId }, { $set: { lastAccessedAt: new Date() } }).catch(() => {});
    } catch (err) {
      console.error('[Socket.io] Error removing whiteboard image:', err.message);
    }
  });

  // ==========================================================
  // STANDALONE WHITEBOARD NAMESPACE / EVENTS
  // ==========================================================
  const Whiteboard = require('./models/Whiteboard');

  socket.on('join_whiteboard', async ({ userName, userId }) => {
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId) return;
    const normalizedName = normalizeName(userName);
    if (!normalizedName) {
      socket.emit('join_error', { message: 'Display name is required.' });
      return;
    }
    socket.join(whiteboardId);
    socket.data.whiteboardId = whiteboardId;
    socket.data.whiteboardUserName = normalizedName;
    upsertParticipant(whiteboardParticipants, whiteboardId, socket.id, normalizedName);
    // console.log(`[Socket.io] Socket ${socket.id} joined standalone whiteboard: ${whiteboardId}`);
    
    if (!whiteboardUsers[whiteboardId]) whiteboardUsers[whiteboardId] = {};
    const existingCount = Object.keys(whiteboardUsers[whiteboardId]).length;
    const color = USER_COLORS[existingCount % USER_COLORS.length];
    const userNumber = existingCount + 1;
    const assignedUserId = userId || socket.id;
    whiteboardUsers[whiteboardId][socket.id] = { userId: assignedUserId, userName: normalizedName, color, userNumber };

    socket.emit('joined_whiteboard', { whiteboardId, color, userNumber, userId: assignedUserId, userName: normalizedName });
    socket.to(whiteboardId).emit('wb_user_joined', { userName: normalizedName });
    io.to(whiteboardId).emit('wb_room_users', { users: participantsList(whiteboardParticipants, whiteboardId) });
    io.to(whiteboardId).emit('user_list', { users: Object.values(whiteboardUsers[whiteboardId]) });
  });

  socket.on('wb_draw_sync', ({ stroke }) => {
    if (!checkSocketRateLimit(socket.id)) return;
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId || !stroke) return;
    socket.to(whiteboardId).emit('wb_receive_sync_stroke', stroke);
  });

  socket.on('wb_draw_stroke', async ({ stroke }) => {
    if (!checkSocketRateLimit(socket.id)) return;
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId || !stroke) return;
    if (!pendingWbStrokes.has(whiteboardId)) pendingWbStrokes.set(whiteboardId, []);
    pendingWbStrokes.get(whiteboardId).push(stroke);
    socket.to(whiteboardId).emit('wb_receive_stroke', stroke);
  });

  // ── Event: wb_flush_strokes ────────────────────────────────
  // Called by the frontend on beforeunload to immediately persist
  // any strokes that are still in the pending buffer.
  // Uses an acknowledgement callback so the client knows it landed.
  socket.on('wb_flush_strokes', async ({ strokes: flushStrokes }, ack) => {
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId || !Array.isArray(flushStrokes) || flushStrokes.length === 0) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    try {
      const Whiteboard = require('./models/Whiteboard');
      // Remove these strokes from the pending buffer to avoid double-persist
      if (pendingWbStrokes.has(whiteboardId)) {
        const flushIds = new Set(flushStrokes.map(s => s.id));
        const remaining = pendingWbStrokes.get(whiteboardId).filter(s => !flushIds.has(s.id));
        if (remaining.length === 0) {
          pendingWbStrokes.delete(whiteboardId);
        } else {
          pendingWbStrokes.set(whiteboardId, remaining);
        }
      }
      // Immediately persist to MongoDB
      await Whiteboard.updateOne(
        { whiteboardId },
        { $push: { strokes: { $each: flushStrokes } } }
      );
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      console.error(`[Socket.io] Error flushing strokes for ${whiteboardId}:`, err.message);
      if (typeof ack === 'function') ack({ ok: false });
    }
  });

  socket.on('wb_clear', async () => {
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId) return;
    try {
      await Whiteboard.updateOne({ whiteboardId }, { $set: { strokes: [], images: [] } });
      socket.to(whiteboardId).emit('wb_clear');
    } catch (err) {
      console.error(`[Socket.io] Error clearing standalone whiteboard:`, err.message);
    }
  });

  socket.on('wb_image_added', async ({ image }) => {
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId || !image) return;
    try {
      const wb = await Whiteboard.findOne({ whiteboardId });
      if (!wb) return;
      const exists = (wb.images || []).some(item => item && item.id === image.id);
      if (!exists) {
        wb.images = [...(wb.images || []), image];
        await wb.save();
      }
      socket.to(whiteboardId).emit('wb_image_added', image);
    } catch (err) {
      console.error(`[Socket.io] Error saving standalone whiteboard image:`, err.message);
    }
  });

  socket.on('wb_image_updated', async ({ image }) => {
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId || !image || !image.id) return;
    try {
      const wb = await Whiteboard.findOne({ whiteboardId });
      if (!wb) return;
      wb.images = (wb.images || []).map(item => (item && item.id === image.id ? { ...item, ...image } : item));
      await wb.save();
      socket.to(whiteboardId).emit('wb_image_updated', image);
    } catch (err) {
      console.error(`[Socket.io] Error updating standalone whiteboard image:`, err.message);
    }
  });

  socket.on('wb_image_removed', async ({ imageId }) => {
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId || !imageId) return;
    try {
      const wb = await Whiteboard.findOne({ whiteboardId });
      if (!wb) return;
      wb.images = (wb.images || []).filter(item => !(item && item.id === imageId));
      await wb.save();
      socket.to(whiteboardId).emit('wb_image_removed', { imageId });
    } catch (err) {
      console.error(`[Socket.io] Error removing standalone whiteboard image:`, err.message);
    }
  });

  socket.on('wb_undo', async () => {
    const whiteboardId = socket.data.whiteboardId;
    if (!whiteboardId) return;
    try {
      // Remove the last stroke from the array using $pop: 1
      await Whiteboard.updateOne({ whiteboardId }, { $pop: { strokes: 1 } });
      socket.to(whiteboardId).emit('wb_undo');
    } catch (err) {
      console.error(`[Socket.io] Error undoing standalone stroke:`, err.message);
    }
  });

  // ── Antigravity Relays ─────────────────────────────────────
  socket.on('user_typing', ({ userId, textBoxId, isTyping }) => {
    const boardId = socket.data.boardId || socket.data.whiteboardId;
    if (!boardId) return;
    const usersMap = socket.data.boardId ? boardUsers[boardId] : whiteboardUsers[boardId];
    const user = usersMap ? usersMap[socket.id] : null;
    socket.to(boardId).emit('user_typing_update', {
      userId, textBoxId, isTyping,
      userName: user?.userName || socket.data.boardUserName || socket.data.whiteboardUserName,
      color: user?.color,
    });
  });

  socket.on('text_content_update', ({ objectId, content }) => {
    const boardId = socket.data.boardId || socket.data.whiteboardId;
    if (!boardId) return;
    socket.to(boardId).emit('receive_text_content', { objectId, content });
  });

  socket.on('cursor_move', ({ userId, userName, color, x, y }) => {
    const boardId = socket.data.boardId || socket.data.whiteboardId;
    if (!boardId) return;
    socket.to(boardId).emit('receive_cursor', { userId, userName, color, x, y });
  });

  // ── Event: disconnect ─────────────────────────────────────
  // Fires automatically when a client closes the connection.
  // Socket.io removes the socket from all rooms automatically.
  socket.on('disconnect', () => {
    socketRateLimits.delete(socket.id);
    const leftBoardName = removeParticipant(boardParticipants, socket.data.boardId, socket.id);
    if (socket.data.boardId && leftBoardName) {
      socket.to(socket.data.boardId).emit('user_left', { userName: leftBoardName, socketId: socket.id });
      io.to(socket.data.boardId).emit('room_users', { users: participantsList(boardParticipants, socket.data.boardId) });

      if (boardUsers[socket.data.boardId] && boardUsers[socket.data.boardId][socket.id]) {
        delete boardUsers[socket.data.boardId][socket.id];
        io.to(socket.data.boardId).emit('user_list', { users: Object.values(boardUsers[socket.data.boardId]) });
      }
    }
    const leftWbName = removeParticipant(whiteboardParticipants, socket.data.whiteboardId, socket.id);
    if (socket.data.whiteboardId && leftWbName) {
      socket.to(socket.data.whiteboardId).emit('wb_user_left', { userName: leftWbName, socketId: socket.id });
      io.to(socket.data.whiteboardId).emit('wb_room_users', { users: participantsList(whiteboardParticipants, socket.data.whiteboardId) });

      if (whiteboardUsers[socket.data.whiteboardId] && whiteboardUsers[socket.data.whiteboardId][socket.id]) {
        delete whiteboardUsers[socket.data.whiteboardId][socket.id];
        io.to(socket.data.whiteboardId).emit('user_list', { users: Object.values(whiteboardUsers[socket.data.whiteboardId]) });
      }
    }
    // console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ── MongoDB connection & server start ───────────────────────
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('[Startup] ❌  MONGODB_URI is not defined in .env');
  process.exit(1); // Exit early — we cannot run without a DB.
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('[MongoDB] ✅  Connected successfully');

    // Start the HTTP server only after DB connection is established.
    httpServer.listen(PORT, () => {
      console.log(`[Server] 🚀  BlackBoard API listening on http://localhost:${PORT}`);
      console.log(`[Server] 🌐  Accepting requests from: ${process.env.CLIENT_URL}`);
    });

    // ── Comprehensive 24-Hour Cleanup Job ───────────────────────
    // Runs every 24 hours: deletes expired boards, old unactivated boards,
    // expired whiteboards, and their associated uploaded files.
    setInterval(async () => {
      try {
        const now = new Date();
        // Instead of hard-deleting immediately, mark boards as expired
        // (soft expiration) when inactivity/fixed rules indicate expiry.
        const activeBoards = await Board.find({ isExpired: false });
        let markedExpired = 0;
        for (const b of activeBoards) {
          try {
            if (hasBoardExpired(b)) {
              b.isExpired = true;
              await b.save();
              markedExpired++;
            }
          } catch (err) {
            console.error('[Cleanup] Error marking board expired:', err.message);
          }
        }
        if (markedExpired > 0) {
          console.log(`[Cleanup] Marked ${markedExpired} boards as expired (soft)`);
        }

        // 4. All whiteboards where expiresAt is older than current time (unchanged)
        const expiredWhiteboards = await Whiteboard.find({ expiresAt: { $lt: now } });
        for (const wb of expiredWhiteboards) {
          try {
            if (wb.images && wb.images.length > 0) {
              wb.images.forEach(img => {
                if (img && img.src && img.src.includes('/uploads/')) {
                   const fileName = img.src.split('/uploads/')[1];
                   if (fileName) {
                     const filePath = path.join(__dirname, 'uploads', fileName);
                     if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                   }
                }
              });
            }
            await Whiteboard.deleteOne({ _id: wb._id });
          } catch (err) {
            console.error('[Cleanup] Error deleting whiteboard:', err.message);
          }
        }
      } catch (err) {
        console.error('[Cleanup] Error during daily cleanup check:', err.message);
      }
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  })
  .catch((err) => {
    console.error('[MongoDB] ❌  Connection failed:', err.message);
    process.exit(1);
  });
