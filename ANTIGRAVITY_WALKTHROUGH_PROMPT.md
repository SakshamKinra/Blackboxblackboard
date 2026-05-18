# ANTIGRAVITY PROMPT — BlackBoard Project Walkthrough Document

> Paste this entire prompt into Antigravity. It will generate a self-contained HTML file.
> The output should be saved as `blackboard-walkthrough.html` and opened in a browser.

---

## THE PROMPT

You are a senior full-stack engineer and technical writer. Your task is to generate a comprehensive, beautifully formatted, self-contained HTML document that serves as a complete project walkthrough for **BlackBoard** — a real-time collaborative whiteboard and note-taking web application.

This document will be used by the developer to:
1. Deeply understand every part of their own project
2. Prepare for a project viva with a professor
3. Understand architectural decisions, tradeoffs, and difficulties

---

## OUTPUT REQUIREMENTS

- Output a **single, complete, self-contained HTML file** — all CSS and JS inline, no external dependencies except Google Fonts (loaded via `<link>`)
- Use a dark theme: background `#0d0d1a`, gold accents `#C9A84C`, text `#f5ecd7`
- Use **Playfair Display** for headings, **Inter** for body text, **JetBrains Mono** for all code
- Include a **fixed left sidebar** (240px) with smooth-scrolling anchor navigation to every section
- Include a **progress bar** at the top that fills as the user scrolls
- All code blocks must be syntax-highlighted (use a simple hand-rolled highlight approach with `<span>` tags and gold/lavender/mint color scheme — no external library)
- Collapsible `<details>` sections for any content that is a list of sub-questions or deep dives
- Mobile responsive — sidebar collapses at <768px
- A "Copy" button on every code block
- The document should feel like a premium technical handbook, not a bland README

---

## DOCUMENT STRUCTURE

Generate ALL of the following sections in full. Do not summarize or skip. Every section must be thorough.

---

### SECTION 1 — Project Identity

**1.1 — What is BlackBoard?**
- Write a clear, precise one-paragraph description of BlackBoard as a product
- What problem does it solve?
- Who is the target user? (students, teams, solo creators, educators)
- What gap does it fill that existing tools (Figma, Notion, Miro, Google Docs) do not fill in an accessible, simple way?
- Why does this project exist?

**1.2 — The Core Value Proposition**
- Real-time collaboration without sign-up friction (name from localStorage, no OAuth)
- Unified workspace: whiteboard + text editor in one place
- Lightweight: no Electron, no heavy framework — just a React SPA + Express API
- Explain each point in 2-3 sentences

**1.3 — Feature Overview Table**
Create an HTML table with columns: Feature | Where it lives | Status | Tech Used
Include every feature: whiteboard canvas, pen tool, shapes, sticky notes, text objects, image upload, zoom/pan, undo/redo, real-time sync, rich text editor, slash commands, presence avatars, cursor presence, attribution labels, command palette, share modal, QR code, toast notifications, canvas grid, soft delete/trash, starred boards, recent boards, sidebar navigation, admin panel

---

### SECTION 2 — Tech Stack Deep Dive

**2.1 — Frontend**

For each technology, write:
- What it is (1 sentence)
- Why it was chosen for BlackBoard specifically
- What it does in this project
- What alternative was considered and why it was rejected

Technologies to cover:
- React 18 (Vite, not CRA — explain why Vite)
- React Router v6 (file-based navigation, nested routes)
- Lucide React (why not FontAwesome or Material Icons)
- TipTap (rich text — explain why not Quill, not Draft.js, not Slate)
- qrcode.react
- react-hot-toast
- Socket.io client

**2.2 — Backend**

Cover each:
- Node.js + Express (why not Fastify, why not NestJS)
- MongoDB + Mongoose (why not PostgreSQL for this use case)
- Socket.io server (why not WebSockets raw, why not Pusher)
- JWT (what it's used for — admin only, not full user auth)
- nanoid (why not UUID)
- dotenv

**2.3 — Infrastructure & Deployment**

- Vercel (frontend) — explain what Vercel does, how it auto-deploys from GitHub
- Render (backend) — explain the free tier cold start problem and how to mitigate it
- MongoDB Atlas (cloud DB) — explain connection string, IP whitelist, env vars
- Explain the environment variable strategy: what lives in `.env`, what goes in Vercel dashboard, what goes in Render dashboard
- Explain why secrets must NEVER be in the frontend bundle

---

### SECTION 3 — Architecture Walkthrough

**3.1 — High-Level Architecture Diagram (ASCII)**

Draw a clear ASCII architecture diagram showing:
```
Browser (React SPA)
    ↕ HTTP (REST API)       ↕ WebSocket (Socket.io)
Express Server (Node.js)
    ↕
MongoDB Atlas
```
Annotate what flows over HTTP vs what flows over WebSocket and why.

**3.2 — Frontend Architecture**

Explain the folder structure:
```
client/src/
  components/
    whiteboard/     ← canvas-specific components
    shared/         ← reusable across pages
  pages/            ← route-level components
  hooks/            ← custom React hooks
  context/          ← React contexts (theme, etc.)
  utils/            ← pure utility functions
  socket.js         ← singleton socket instance
  api.js            ← axios instance with base URL
```

For each folder, explain:
- What lives there
- Why it is separated this way
- The naming conventions

**3.3 — Backend Architecture**

Explain the folder structure:
```
server/
  routes/           ← Express route definitions
  controllers/      ← Business logic
  models/           ← Mongoose schemas
  middleware/       ← Auth, error handling
  socket/           ← Socket.io event handlers
  server.js         ← Entry point
```

**3.4 — The Unified Object System**

This is CRITICAL. Explain in detail:
- Why every whiteboard object (pen stroke, text, image, shape, sticky note) must follow the unified structure: `{ id, type, x, y, width, height, ...typeSpecificFields }`
- What breaks if objects don't follow this structure (undo/redo, sync, selection, serialization)
- How the `type` field acts as a discriminator for rendering
- Show a code example of each object type side-by-side in a comparison table

**3.5 — Real-Time Sync Architecture**

Explain the entire Socket.io flow:
- How a user drawing a stroke flows from mouse event → state → socket emit → server → broadcast → other clients → render
- What events exist and what payload each carries (table: Event Name | Direction | Payload | Purpose)
- Why the server is a relay (does not process drawing data, just broadcasts)
- How undo/redo is synced across clients
- The debounce strategy for text content sync vs immediate sync for strokes

**3.6 — State Management Philosophy**

Explain the deliberate decision to use NO Redux, NO Zustand:
- What state lives in local component state (useState)
- What state lives in React Context (theme)
- What state lives in localStorage (username, color, grid preference, sidebar collapse)
- What state lives on the server (board content, MongoDB)
- Why this is appropriate for this project's scale
- When this would break down (at what scale would you need Redux?)

**3.7 — The Coordinate System**

This is one of the trickiest parts. Explain:
- The raw mouse coordinate system (pixels from top-left of screen)
- The canvas coordinate system (accounting for pan offset)
- The zoom-normalized coordinate system: `canvasX = (mouseX - panX) / zoom`
- Why you must normalize EVERYWHERE (drawing, placing, dragging, resizing, cursor presence)
- What happens if you forget to normalize (with a concrete example: place sticky at 200% zoom without normalizing — it appears in wrong position)
- The reverse transform for displaying remote cursors: `displayX = x * zoom + panX`

---

### SECTION 4 — Feature-by-Feature Technical Breakdown

For each feature below, explain:
a) What it does from the user's perspective (1-2 sentences)
b) How it works technically (data flow, key functions, React state involved)
c) The hardest part of implementing it
d) Any edge cases or bugs encountered and how they were resolved

Features to cover (each as its own sub-section):

**4.1 — Pen/Drawing Tool**
- Canvas API vs DOM overlay approach (explain which is used and why)
- How stroke points are collected during mouse move
- How strokes are committed on mouse up
- Performance: why requestAnimationFrame matters here

**4.2 — Text Objects on Canvas**
- Why text is a DOM overlay (contentEditable div) NOT drawn on canvas
- How position is calculated relative to canvas
- The attribution label system (authorName, authorColor, always-visible)
- Live typing indicator: `user_typing` socket event, 2s timeout to stop

**4.3 — Shapes (Rectangle, Circle, Triangle, Diamond)**
- Draw-to-create: mouse down → drag preview → mouse up → committed shape
- How CSS clip-path/border-radius achieves each shape without SVG
- Editable label via double-click (contentEditable inside shape div)
- Resize handles: 4 corner divs, how drag delta maps to width/height change

**4.4 — Sticky Notes**
- Why rotation is explicitly set to 0 (rotation causes coordinate sync bugs — explain what specifically breaks)
- The color palette system (5 colors)
- Why font color is always `#2a1f0e` regardless of theme (readability on colored background)
- Resize from bottom-right corner only

**4.5 — Undo / Redo**
- The stack data structure: `history[]` and `redoStack[]`
- What gets pushed: full snapshots vs delta patches (which approach and why)
- How undo is synced via Socket.io to other clients
- Edge case: what happens if two users undo simultaneously?

**4.6 — Zoom & Pan**
- CSS `transform: scale(zoom) translate(panX, panY)` on the canvas container
- Why `transformOrigin: '0 0'` is critical
- Zoom centered on cursor: the math explained step by step
- Three pan methods: Space+drag, middle mouse button, Pan tool
- Fit to view: bounding box calculation

**4.7 — Real-Time Presence (Avatars)**
- How server assigns colors deterministically by connection order
- The `roomUsers` in-memory registry on the server
- Avatar stacking with negative margin and z-index
- Fade in/out on join/leave (CSS transition)

**4.8 — Cursor Presence**
- Why throttled to 50ms (20fps) — bandwidth math: 20 events/s × 50 bytes = 1KB/s per user
- Zoom-corrected coordinates for display
- The 4-second stale cursor cleanup
- Why you must filter out your own cursor (userId comparison)

**4.9 — Rich Text Editor (TipTap)**
- Why TipTap was chosen (ProseMirror-based, extension system, no Yjs required)
- The extensions used and what each does (StarterKit, Placeholder, Typography, Highlight, TaskList, TaskItem, Image, Link)
- Why Yjs/collaboration extension was explicitly excluded (complexity, CRDT overhead for single-editor-at-a-time use case)
- The debounced JSON sync strategy (2 seconds, full document, not delta)
- Slash commands: how `/` keydown is detected and dropdown positioned

**4.10 — Command Palette**
- Global Ctrl+K listener attached at App level
- Keyboard navigation: ArrowUp/Down changes `activeIndex` state
- Fuzzy filtering: `title.toLowerCase().includes(query.toLowerCase())`
- Why not a proper fuzzy search library (overkill, simple substring is sufficient)

**4.11 — Soft Delete & Trash**
- `isDeleted: true` flag vs actually deleting from MongoDB (why soft delete?)
- How "Recent", "Starred", "Trash" are computed from the same collection with different filters
- Why no separate MongoDB collections for these views
- The restore flow

**4.12 — User Attribution Labels**
- Server assigns color on socket join (not client-chosen)
- Why authorColor is stored on the object (not looked up dynamically) — sync correctness
- The `user_typing` event throttle (500ms emit, 2s timeout to stop)
- Label always visible (not hover-only) — why? (clarity of authorship at a glance)

---

### SECTION 5 — Architecture Critique

**5.1 — What is Good Architecture Here**

Be specific and honest:
- Separation of concerns: socket handlers separate from routes separate from models
- Unified object system: one renderer, one undo stack, one sync event handles all object types
- No premature optimization: simple debounce instead of CRDT, simple substring search instead of fuzzy lib
- Stateless server: no session state on Express server (socket room state is ephemeral, acceptable)
- Single socket instance (socket.js singleton): prevents duplicate connections

**5.2 — What is Not Ideal Architecture**

Be equally honest:
- `roomUsers` lives in server memory: a server restart loses all presence data. In production you'd use Redis pub/sub
- No auth on socket events: anyone who knows a board ID can join and emit events. Acceptable for this scope but a security gap
- Full document sync for TipTap (not delta/CRDT): two simultaneous editors will overwrite each other. Fine for "mostly one editor at a time" but not true collaborative editing
- localStorage for username/identity: not persistent across devices, not secure
- No rate limiting on socket events: a malicious client could spam `wb_draw_stroke` and flood other clients
- The `lastOpenedAt` approach for "recent" is correct but requires an extra DB write on every board open — could be deferred

**5.3 — Scalability Analysis**

Answer these questions with concrete numbers and reasoning:
- How many concurrent users per board can this handle? (Socket.io single server, ~1000 connections)
- What happens at 10,000 boards? (MongoDB query performance, indexing strategy)
- What would need to change for a production SaaS product? (Redis for pub/sub, auth, rate limiting, CDN for assets, horizontal scaling)

---

### SECTION 6 — Difficulties & Decisions During Development

Write this section as a narrative — the real story of what was hard. Cover:

**6.1 — The Coordinate System Bug**
- The symptom: objects placed at wrong position when zoomed
- The root cause: raw mouse coordinates not normalized for zoom
- The fix: `canvasX = (mouseX - panX) / zoom` applied everywhere
- Why "everywhere" is the hard part (you have to audit every single mouse handler)

**6.2 — Undo/Redo Sync Complexity**
- Why undo across multiple clients is inherently hard (distributed state)
- The simplification chosen: server broadcasts undo, all clients apply it
- What edge case this doesn't handle perfectly (simultaneous undo)

**6.3 — The Whiteboard.jsx vs WhiteboardPage.jsx Divergence**
- What caused them to diverge (one was the "embedded" version, one was standalone)
- Why this was dangerous (bug fixed in one, not the other)
- The fix: share the same core canvas logic via a shared component/hook

**6.4 — Sticky Note Rotation Was Removed**
- The original design had random rotation (like real sticky notes)
- Why it was removed: CSS `transform: rotate()` breaks the coordinate math for drag and resize
- The lesson: visual polish that interferes with math must be deferred or redesigned

**6.5 — TipTap Extension Choices**
- The temptation to use `@tiptap/extension-collaboration` (Yjs)
- Why it was rejected: Yjs adds CRDT complexity, binary encoding, awareness protocol — overkill
- The chosen approach: debounced JSON, only update if not focused — good enough

**6.6 — Performance on Dense Whiteboards**
- Symptom: lag with 20+ objects
- Root cause: re-rendering all objects on every mouse move
- Fix: `useMemo`, `useCallback`, careful dependency arrays, only re-render changed objects

---

### SECTION 7 — Viva Q&A Preparation

Generate 40 questions a professor might ask during a project viva, grouped by category. For each question, provide a model answer (3-6 sentences, technically precise).

**Category A — Fundamentals (10 questions)**
Example topics: What is WebSocket vs HTTP? Why use Socket.io over raw WebSocket? What is a REST API? What is MongoDB? Why NoSQL for this project? What is React? What is a React hook? What is useEffect? What is useState? What is a component?

**Category B — Architecture (10 questions)**
Example topics: Why no Redux? Why no SQL? How does real-time sync work? What happens if the server crashes? How do you handle multiple users editing simultaneously? What is a Mongoose schema? What is a socket room? Why is the socket server a relay? What is CORS and why do you need it? What is an environment variable?

**Category C — Feature-Specific (10 questions)**
Example topics: How does undo/redo work? How does zoom work? How do you know where to place an object on the canvas? How do attribution labels work? How does the command palette search? How does TipTap save content? How does the QR code work? How do avatars get their colors? How does soft delete work? How does the canvas grid render?

**Category D — Security & Deployment (5 questions)**
Example topics: How do you prevent exposing secrets? What is JWT used for? What is the difference between Vercel and Render? What is MongoDB Atlas? Why does your backend go to sleep?

**Category E — Critique & Improvement (5 questions)**
Example topics: What would you do differently? How would you add proper authentication? What is a CRDT and when would you use one? How would you scale this to 10,000 users? What is Redis and why might you need it?

---

### SECTION 8 — Glossary

Create a glossary of every technical term used in the project that a student must be able to define:

Terms to include (at minimum):
WebSocket, Socket.io, REST API, HTTP, JSON, React, Component, Hook, useState, useEffect, useRef, useCallback, useMemo, Context, MongoDB, Mongoose, Schema, Document, Express, Middleware, CORS, JWT, nanoid, localStorage, contentEditable, Canvas API, DOM, CSS Transform, Zoom, Pan, Debounce, Throttle, Undo Stack, CRDT, Yjs, TipTap, ProseMirror, Vite, Vercel, Render, Atlas, Environment Variable, .gitignore, Socket Room, Emit, Broadcast, Relay, Singleton, Soft Delete, Glassmorphism, Transform Origin, requestAnimationFrame

For each term: 2-3 sentence definition in plain English, then 1 sentence on how it's used specifically in BlackBoard.

---

### SECTION 9 — Quick Reference Cards

Generate these as visually distinct "card" components in the HTML:

**Card 1 — Socket Events Reference**
Table: Event Name | Direction | Who emits | Who receives | Payload shape | Purpose

**Card 2 — MongoDB Schema Summary**
Show the key fields of Board, Whiteboard schemas in a clean table

**Card 3 — Object Type Reference**
Show all whiteboard object types and their fields in a comparison table

**Card 4 — Keyboard Shortcuts**
All keyboard shortcuts in a clean two-column layout

**Card 5 — Environment Variables**
All env vars: Name | Where it lives (frontend/backend) | What it contains | Required?

---

### SECTION 10 — One-Page Cheat Sheet

At the very end, generate a single "cheat sheet" section styled distinctly (slightly different background `#111128`, gold border) that contains:
- The 5 most important architectural decisions and the one-line reason for each
- The 5 trickiest bugs and the one-line fix for each
- The 5 most likely viva questions and the one-sentence answer for each
- The tech stack in one line per technology

---

## HTML STYLING REQUIREMENTS

```css
/* Core palette */
--bg:        #0d0d1a
--surface:   #151524
--border:    rgba(201, 168, 76, 0.15)
--gold:      #C9A84C
--text:      #f5ecd7
--muted:     rgba(245, 236, 215, 0.45)
--pink:      #ED93B1
--lavender:  #AFA9EC
--mint:      #6EC9A8
--coral:     #E8956D

/* Fonts */
Playfair Display — headings (load from Google Fonts)
Inter          — body
JetBrains Mono — code
```

Code block styling:
- Background: `#0a0a16`
- Border: `1px solid rgba(201,168,76,0.2)`
- Border-radius: 8px
- Keywords (const, let, function, import, export, return, if, else): `#AFA9EC` (lavender)
- Strings: `#6EC9A8` (mint)
- Comments: `rgba(245,236,215,0.3)` (muted)
- Numbers/booleans: `#E8956D` (coral)
- Function names: `#C9A84C` (gold)
- Default text: `#f5ecd7`

Section headers: gold left border `4px solid #C9A84C`, padding-left 16px

Sidebar nav:
- Active item: gold text, background `rgba(201,168,76,0.08)`, left border `3px solid #C9A84C`
- Hover: text brightens slightly
- Smooth scroll to section anchor

Tables:
- Header row background: `rgba(201,168,76,0.1)`
- Alternating row backgrounds: transparent / `rgba(201,168,76,0.03)`
- Border: `1px solid rgba(201,168,76,0.1)`

Details/summary (collapsible sections):
- Summary: gold text, cursor pointer, `▸` / `▾` indicator
- Content: indented, with left border `2px solid rgba(201,168,76,0.2)`

Progress bar:
- Fixed top, height 3px, background `#C9A84C`
- Filled via `scrollY / (documentHeight - viewportHeight) * 100%` in JavaScript

---

## FINAL INSTRUCTION

Generate the complete HTML file now. Do not truncate. Do not summarize any section. Every section listed above must be fully written out. The file should be approximately 2,000–4,000 lines of HTML. This is a comprehensive technical reference document and every word must be accurate and useful.

Start with `<!DOCTYPE html>` and end with `</html>`. Output nothing else.
