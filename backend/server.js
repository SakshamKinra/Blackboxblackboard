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
      'https://blackboxblackboard.vercel.app/',
      'http://localhost:3000'
    ];
    if (!origin || allowedOrigins.some(o => origin.startsWith(o.replace(/\/$/, '')))) {
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
const boardParticipants = new Map();
const whiteboardParticipants = new Map();

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
  // Payload: { boardId: string }
  socket.on('join_board', async ({ boardId, userName }) => {
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
    console.log(`[Socket.io] Socket ${socket.id} joined room: ${boardId}`);

    // Acknowledge the join to the connecting client only.
    socket.emit('joined_board', { boardId, message: 'Joined board room' });
    socket.to(boardId).emit('user_joined', { userName: normalizedName });
    io.to(boardId).emit('room_users', { users: participantsList(boardParticipants, boardId) });

    try {
      // Send existing whiteboard data to the newly joined user
      const board = await Board.findOne({ boardId });
      if (board && board.whiteboardData && board.whiteboardData.length > 0) {
        socket.emit('whiteboard_data', board.whiteboardData);
      }
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
  // Payload: { boardId: string, content: string }
  socket.on('text_update', async ({ boardId, content, userName }) => {
    if (!boardId) return;
    const author = normalizeName(userName) || socket.data.boardUserName || 'Anonymous';

    try {
      // Persist updated content to MongoDB.
      await Board.findOneAndUpdate(
        { boardId },
        { content },
        { new: true }          // return updated doc (not used here but good practice)
      );

      // Broadcast to every OTHER socket in the room (not the sender).
      // This prevents the sender from receiving its own echo.
      socket.to(boardId).emit('receive_update', { boardId, content });
      socket.to(boardId).emit('text_update_author', {
        boardId,
        content,
        userName: author,
        timestamp: Date.now(),
      });

      console.log(`[Socket.io] Content updated for board: ${boardId}`);
    } catch (err) {
      console.error(`[Socket.io] Error saving content for board ${boardId}:`, err.message);
      // Notify the sender of the failure so the UI can handle it.
      socket.emit('update_error', {
        message: 'Failed to save content. Please try again.',
      });
    }
  });

  socket.on('text_typing', ({ boardId, userName }) => {
    if (!boardId) return;
    const author = normalizeName(userName) || socket.data.boardUserName || 'Anonymous';
    socket.to(boardId).emit('text_typing', { boardId, userName: author, timestamp: Date.now() });
  });

  // ── Event: image_added ──────────────────────────────────
  // Sent when a user uploads an image to the text board.
  // Broadcasts updated content with the image to all other users.
  //
  // Payload: { boardId: string, content: string, imageUrl: string }
  socket.on('image_added', async ({ boardId, content, imageUrl, userName }) => {
    if (!boardId) return;
    const author = normalizeName(userName) || socket.data.boardUserName || 'Anonymous';
    // Broadcast the updated content with the image to other users
    socket.to(boardId).emit('image_added', { boardId, content, imageUrl, userName: author });
    console.log(`[Socket.io] Image added to board: ${boardId}`);
  });

  // ── Event: draw_stroke ────────────────────────────────────
  socket.on('draw_stroke', async ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;
    try {
      await Board.updateOne({ boardId }, { $push: { whiteboardData: stroke } });
      socket.to(boardId).emit('receive_stroke', stroke);
    } catch (err) {
      console.error(`[Socket.io] Error saving stroke:`, err.message);
    }
  });

  // ── Event: clear_whiteboard ────────────────────────────────
  socket.on('clear_whiteboard', async ({ boardId }) => {
    if (!boardId) return;
    try {
      await Board.updateOne({ boardId }, { $set: { whiteboardData: [] } });
      socket.to(boardId).emit('clear_whiteboard');
    } catch (err) {
      console.error(`[Socket.io] Error clearing whiteboard:`, err.message);
    }
  });

  // ── Event: whiteboard_image_added ──────────────────────────
  socket.on('whiteboard_image_added', async ({ boardId, image }) => {
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
    } catch (err) {
      console.error(`[Socket.io] Error saving whiteboard image:`, err.message);
    }
  });

  socket.on('whiteboard_image_updated', async ({ boardId, image }) => {
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
    } catch (err) {
      console.error('[Socket.io] Error updating whiteboard image:', err.message);
    }
  });

  socket.on('whiteboard_image_removed', async ({ boardId, imageId }) => {
    if (!boardId || !imageId) return;
    try {
      const board = await Board.findOne({ boardId });
      if (!board) return;
      const data = Array.isArray(board.whiteboardData) ? board.whiteboardData : [];
      board.whiteboardData = data.filter(item => !(item && item.type === 'image' && item.id === imageId));
      await board.save();
      socket.to(boardId).emit('whiteboard_image_removed', { imageId });
    } catch (err) {
      console.error('[Socket.io] Error removing whiteboard image:', err.message);
    }
  });

  // ==========================================================
  // STANDALONE WHITEBOARD NAMESPACE / EVENTS
  // ==========================================================
  const Whiteboard = require('./models/Whiteboard');

  socket.on('join_whiteboard', async ({ whiteboardId, userName }) => {
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
    console.log(`[Socket.io] Socket ${socket.id} joined standalone whiteboard: ${whiteboardId}`);
    socket.emit('joined_whiteboard', { whiteboardId });
    socket.to(whiteboardId).emit('wb_user_joined', { userName: normalizedName });
    io.to(whiteboardId).emit('wb_room_users', { users: participantsList(whiteboardParticipants, whiteboardId) });
  });

  socket.on('wb_draw_stroke', async ({ whiteboardId, stroke }) => {
    if (!whiteboardId || !stroke) return;
    try {
      await Whiteboard.updateOne({ whiteboardId }, { $push: { strokes: stroke } });
      socket.to(whiteboardId).emit('wb_receive_stroke', stroke);
    } catch (err) {
      console.error(`[Socket.io] Error saving standalone stroke:`, err.message);
    }
  });

  socket.on('wb_clear', async ({ whiteboardId }) => {
    if (!whiteboardId) return;
    try {
      await Whiteboard.updateOne({ whiteboardId }, { $set: { strokes: [], images: [] } });
      socket.to(whiteboardId).emit('wb_clear');
    } catch (err) {
      console.error(`[Socket.io] Error clearing standalone whiteboard:`, err.message);
    }
  });

  socket.on('wb_image_added', async ({ whiteboardId, image }) => {
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

  socket.on('wb_image_updated', async ({ whiteboardId, image }) => {
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

  socket.on('wb_image_removed', async ({ whiteboardId, imageId }) => {
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

  socket.on('wb_undo', async ({ whiteboardId }) => {
    if (!whiteboardId) return;
    try {
      // Remove the last stroke from the array using $pop: 1
      await Whiteboard.updateOne({ whiteboardId }, { $pop: { strokes: 1 } });
      socket.to(whiteboardId).emit('wb_undo');
    } catch (err) {
      console.error(`[Socket.io] Error undoing standalone stroke:`, err.message);
    }
  });

  // ── Event: disconnect ─────────────────────────────────────
  // Fires automatically when a client closes the connection.
  // Socket.io removes the socket from all rooms automatically.
  socket.on('disconnect', () => {
    const leftBoardName = removeParticipant(boardParticipants, socket.data.boardId, socket.id);
    if (socket.data.boardId && leftBoardName) {
      socket.to(socket.data.boardId).emit('user_left', { userName: leftBoardName });
      io.to(socket.data.boardId).emit('room_users', { users: participantsList(boardParticipants, socket.data.boardId) });
    }
    const leftWbName = removeParticipant(whiteboardParticipants, socket.data.whiteboardId, socket.id);
    if (socket.data.whiteboardId && leftWbName) {
      socket.to(socket.data.whiteboardId).emit('wb_user_left', { userName: leftWbName });
      io.to(socket.data.whiteboardId).emit('wb_room_users', { users: participantsList(whiteboardParticipants, socket.data.whiteboardId) });
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
        let deletedBoardsCount = 0;
        let deletedWhiteboardsCount = 0;

        // Helper to delete physical files
        const deleteImages = (imagesArray) => {
          if (!imagesArray || imagesArray.length === 0) return;
          imagesArray.forEach(imageUrl => {
            try {
              const fileName = imageUrl.split('/uploads/')[1];
              if (fileName) {
                const filePath = path.join(__dirname, 'uploads', fileName);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                }
              }
            } catch (err) {
              console.error(`[Cleanup] Failed to delete image ${imageUrl}:`, err.message);
            }
          });
        };

        // 1. All boards where isExpired: true
        const explicitlyExpired = await Board.find({ isExpired: true });
        
        // 2. All boards where activatedAt exists and activatedAt + expiresAfter hours has passed
        const activeBoards = await Board.find({ activatedAt: { $ne: null }, isExpired: false });
        const dynamicallyExpired = activeBoards.filter(b => {
          const expiryTime = new Date(b.activatedAt).getTime() + b.expiresAfter * 60 * 60 * 1000;
          return now.getTime() > expiryTime;
        });

        // 3. All boards older than 7 days that were never activated
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const oldUnactivated = await Board.find({
          activatedAt: null,
          createdAt: { $lt: sevenDaysAgo }
        });

        const allBoardsToDelete = [...explicitlyExpired, ...dynamicallyExpired, ...oldUnactivated];
        
        // Remove duplicates if any
        const uniqueBoardsToDelete = Array.from(new Set(allBoardsToDelete.map(b => b._id.toString())))
          .map(id => allBoardsToDelete.find(b => b._id.toString() === id));

        for (const board of uniqueBoardsToDelete) {
          deleteImages(board.attachedImages);
          deleteImages(board.images);
          await Board.deleteOne({ _id: board._id });
          deletedBoardsCount++;
        }

        // 4. All whiteboards where expiresAt is older than current time
        const expiredWhiteboards = await Whiteboard.find({ expiresAt: { $lt: now } });
        for (const wb of expiredWhiteboards) {
          if (wb.images && wb.images.length > 0) {
            wb.images.forEach(img => {
              if (img && img.src && img.src.includes('/uploads/')) {
                 deleteImages([img.src]);
              }
            });
          }
          await Whiteboard.deleteOne({ _id: wb._id });
          deletedWhiteboardsCount++;
        }

        if (deletedBoardsCount > 0 || deletedWhiteboardsCount > 0) {
          console.log(`[Cleanup] Deleted ${deletedBoardsCount} boards, ${deletedWhiteboardsCount} whiteboards`);
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
