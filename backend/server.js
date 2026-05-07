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

// Internal modules
const boardRoutes = require('./routes/boardRoutes');
const errorHandler = require('./middleware/errorHandler');
const Board = require('./models/Board');

// ── Express app & raw HTTP server ───────────────────────────
// Socket.io needs the raw http.Server instance, not the Express
// app directly, so we create it explicitly.
const app = express();
const httpServer = http.createServer(app);

// ── Socket.io setup ─────────────────────────────────────────
// Allow connections from the frontend origin defined in .env.
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ── CORS — Express REST API ──────────────────────────────────
// Restricts REST API access to the configured frontend origin.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ── Body parsing ─────────────────────────────────────────────
// Parse incoming JSON request bodies (required for POST routes).
app.use(express.json());
// Parse URL-encoded bodies (e.g., from HTML forms).
app.use(express.urlencoded({ extended: true }));

// ── Health-check route ───────────────────────────────────────
// A simple GET / endpoint to confirm the server is alive.
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'BlackBoard API is running 🟢' });
});

// ── API Routes ───────────────────────────────────────────────
// All board-related REST endpoints are mounted under /api/boards.
app.use('/api/boards', boardRoutes);

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
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // ── Event: join_board ──────────────────────────────────────
  // Called by the frontend after a board is unlocked.
  // The client joins the room so it can send/receive updates.
  //
  // Payload: { boardId: string }
  socket.on('join_board', ({ boardId }) => {
    if (!boardId) return;

    socket.join(boardId); // join the room named after the boardId
    console.log(`[Socket.io] Socket ${socket.id} joined room: ${boardId}`);

    // Acknowledge the join to the connecting client only.
    socket.emit('joined_board', { boardId, message: 'Joined board room' });
  });

  // ── Event: text_update ────────────────────────────────────
  // Sent by a client when the board content changes.
  // The server:
  //   1. Persists the new content to MongoDB.
  //   2. Broadcasts it to ALL OTHER clients in the same room.
  //
  // Payload: { boardId: string, content: string }
  socket.on('text_update', async ({ boardId, content }) => {
    if (!boardId) return;

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

      console.log(`[Socket.io] Content updated for board: ${boardId}`);
    } catch (err) {
      console.error(`[Socket.io] Error saving content for board ${boardId}:`, err.message);
      // Notify the sender of the failure so the UI can handle it.
      socket.emit('update_error', {
        message: 'Failed to save content. Please try again.',
      });
    }
  });

  // ── Event: disconnect ─────────────────────────────────────
  // Fires automatically when a client closes the connection.
  // Socket.io removes the socket from all rooms automatically.
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
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
  })
  .catch((err) => {
    console.error('[MongoDB] ❌  Connection failed:', err.message);
    process.exit(1);
  });
