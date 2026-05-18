# BlackBoard — Antigravity Implementation Plan
# Version 3.0 — Remaining Features + Safety Audit
# Generated: May 2026

---

## CONTEXT

The following bugs are **already fixed** and must NOT be re-touched:
- Sticky note text overflow
- Stroke loss on fast draw + reload
- Locked whiteboard missing shapes/stickies
- Locked vs standalone whiteboard parity (Whiteboard.jsx / WhiteboardPage.jsx divergence)

This plan covers only **unimplemented or semi-implemented** features from the original spec, plus a security/architecture safety report.

---

## PHASE 0 — FRONTEND FILE AUDIT (Run Before Anything)

Before writing a single line of feature code, scan the frontend for files that should not exist there.

### Files That Must NOT Be in the Frontend

| What to look for | Why it's dangerous |
|---|---|
| `.env` files with secrets | Exposes API keys, DB URIs to the browser |
| Any file containing `MONGO_URI`, `JWT_SECRET`, `DB_PASSWORD` | Credentials visible in source |
| Server-side route files (`routes/`, `controllers/`, `middleware/`) committed to `client/src/` | Business logic exposed |
| Admin credential files (e.g., `adminConfig.js` with hardcoded passwords) | Security hole |
| Raw Mongoose model files in `client/` | Schema leakage |
| `node_modules` committed to git | Bloat and potential supply chain issues |

### Audit Checklist

```bash
# Run these in your project root before starting:

# 1. Check for secrets in frontend
grep -r "MONGO_URI\|JWT_SECRET\|PASSWORD\|SECRET" client/src/

# 2. Check for server files accidentally in client
find client/src -name "*.js" | xargs grep -l "mongoose\|express\|require('dotenv')"

# 3. Check .gitignore covers .env
cat .gitignore | grep ".env"

# 4. Check no .env in client/
ls -la client/.env 2>/dev/null && echo "WARNING: .env found in client"

# 5. List any non-component files in client/src that look like backend code
find client/src -name "*.js" -not -path "*/node_modules/*" | head -40
```

### Expected Clean State
```
client/src/
  components/       ← React components only
  pages/            ← Page components only
  hooks/            ← Custom hooks only
  context/          ← React contexts only
  utils/            ← Pure utility functions (no secrets)
  assets/           ← Static assets only
  socket.js         ← Socket.io client init (no secrets, just URL)
  api.js            ← Axios instance (base URL from env var, not hardcoded)
```

### If You Find Issues
- Move any backend files to `server/` immediately
- Move secrets to `.env` and add `.env` to `.gitignore`
- Replace hardcoded URLs with `import.meta.env.VITE_API_URL`

---

## PHASE 1 — TEXT BOX USER ATTRIBUTION SYSTEM

### Overview
Every text object on the whiteboard must show a persistent attribution label (who created it), a live typing indicator, and user color assignment from the server.

### 1.1 — Server: Color + User Number Assignment

**File: `server/socket/whiteboardHandlers.js`** (or wherever your socket room logic lives)

Add room-level user tracking on `join_board`:

```js
// In-memory room registry (resets on server restart — acceptable)
const roomUsers = {}  // { boardId: { socketId: { userId, userName, color, userNumber } } }

const USER_COLORS = [
  '#C9A84C',  // gold
  '#ED93B1',  // blush pink
  '#AFA9EC',  // lavender
  '#6EC9A8',  // mint
  '#E8956D',  // coral
  '#64B5F6',  // sky blue
]

socket.on('join_board', ({ boardId, userId, userName }) => {
  if (!roomUsers[boardId]) roomUsers[boardId] = {}

  // Assign color by position in room
  const existingCount = Object.keys(roomUsers[boardId]).length
  const color = USER_COLORS[existingCount % USER_COLORS.length]
  const userNumber = existingCount + 1

  roomUsers[boardId][socket.id] = { userId, userName, color, userNumber }

  socket.join(boardId)

  // Send this user their assigned color/number
  socket.emit('joined_board', { userId, userName, color, userNumber })

  // Broadcast updated user list to room
  const users = Object.values(roomUsers[boardId])
  io.to(boardId).emit('user_list', { users })
})

socket.on('disconnect', () => {
  // Remove from all rooms
  for (const [boardId, users] of Object.entries(roomUsers)) {
    if (users[socket.id]) {
      delete users[socket.id]
      const remaining = Object.values(users)
      io.to(boardId).emit('user_list', { users: remaining })
      io.to(boardId).emit('user_left', { socketId: socket.id })
    }
  }
})
```

**New socket events added:**
- `join_board` (client → server): `{ boardId, userId, userName }`
- `joined_board` (server → client): `{ userId, userName, color, userNumber }`
- `user_list` (server → all in room): `{ users: [{userId, userName, color, userNumber}] }`
- `user_left` (server → all in room): `{ socketId }`

---

### 1.2 — Client: useUserColor Hook

**New file: `client/src/hooks/useUserColor.js`**

```js
import { useState, useEffect } from 'react'
import { socket } from '../socket'

export function useUserColor(boardId) {
  const [myColor, setMyColor] = useState('#C9A84C')
  const [myNumber, setMyNumber] = useState(1)
  const [activeUsers, setActiveUsers] = useState([])

  useEffect(() => {
    const userId = localStorage.getItem('bb_user_id') || generateId()
    const userName = localStorage.getItem('bb_user_name') || 'Anonymous'

    socket.emit('join_board', { boardId, userId, userName })

    socket.on('joined_board', ({ color, userNumber }) => {
      setMyColor(color)
      setMyNumber(userNumber)
      localStorage.setItem('bb_user_color', color)
    })

    socket.on('user_list', ({ users }) => {
      setActiveUsers(users)
    })

    return () => {
      socket.off('joined_board')
      socket.off('user_list')
    }
  }, [boardId])

  return { myColor, myNumber, activeUsers }
}
```

---

### 1.3 — Attribution Label Component

**New file: `client/src/components/whiteboard/AttributionLabel.jsx`**

```jsx
// Props: userName, color, isTyping
export function AttributionLabel({ userName, color, isTyping }) {
  return (
    <div style={{
      position: 'absolute',
      top: -24,
      left: 0,
      background: color,
      color: '#0d0d1a',
      fontSize: 10,
      fontWeight: 700,
      fontFamily: 'Inter, sans-serif',
      padding: '2px 6px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      userSelect: 'none',
      boxShadow: isTyping ? `0 0 6px ${color}99` : 'none',
      transition: 'box-shadow 200ms ease',
      zIndex: 10,
    }}>
      {userName}{isTyping ? ' ✍️' : ''}
    </div>
  )
}
```

---

### 1.4 — Text Object: Add authorId + authorName + authorColor Fields

**When creating any text object**, attach attribution:

```js
// In whatever function creates text objects:
const newTextObject = {
  id: nanoid(),
  type: 'text',
  x: canvasX,
  y: canvasY,
  width: 200,
  height: 40,
  content: '',
  fontSize: 16,
  color: '#f5ecd7',
  // --- NEW FIELDS ---
  authorId: localStorage.getItem('bb_user_id'),
  authorName: localStorage.getItem('bb_user_name') || `User ${myNumber}`,
  authorColor: myColor,
}
```

**When receiving remote text objects**, the `authorName` and `authorColor` come in with the object — no extra lookup needed.

---

### 1.5 — TextObject Component: Render Label

**File: `client/src/components/whiteboard/TextObject.jsx`** (modify existing)

Inside the positioned wrapper div, add the label:

```jsx
<div style={{ position: 'relative' }}>
  {/* Attribution label */}
  <AttributionLabel
    userName={obj.authorName || 'Anonymous'}
    color={obj.authorColor || '#C9A84C'}
    isTyping={typingUsers[obj.id] !== undefined}
  />
  {/* Existing text content */}
  <div
    contentEditable={isSelected}
    suppressContentEditableWarning
    // ... existing props
  />
</div>
```

---

### 1.6 — Live Typing Indicator

**Socket events to add:**
- `user_typing` (client → server): `{ userId, textBoxId, isTyping }`
- `user_typing_update` (server → room): `{ userId, textBoxId, isTyping, userName, color }`

**Server handler** (add to whiteboardHandlers.js):
```js
socket.on('user_typing', ({ userId, textBoxId, isTyping }) => {
  const boardId = getUserBoardId(socket.id) // look up from roomUsers
  socket.to(boardId).emit('user_typing_update', {
    userId, textBoxId, isTyping,
    userName: roomUsers[boardId]?.[socket.id]?.userName,
    color: roomUsers[boardId]?.[socket.id]?.color,
  })
})
```

**Client: track typing state in whiteboard:**
```js
const [typingUsers, setTypingUsers] = useState({})
// typingUsers shape: { [textBoxId]: { userId, userName, color } }

// In useEffect with socket:
socket.on('user_typing_update', ({ userId, textBoxId, isTyping, userName, color }) => {
  setTypingUsers(prev => {
    if (!isTyping) {
      const next = { ...prev }
      delete next[textBoxId]
      return next
    }
    return { ...prev, [textBoxId]: { userId, userName, color } }
  })
})
```

**In TextObject — emit typing events:**
```js
// Throttle ref
const typingTimerRef = useRef(null)

const handleInput = (e) => {
  // Existing content update logic...

  // Emit typing start
  socket.emit('user_typing', { userId: myUserId, textBoxId: obj.id, isTyping: true })

  // Auto-stop after 2s inactivity
  clearTimeout(typingTimerRef.current)
  typingTimerRef.current = setTimeout(() => {
    socket.emit('user_typing', { userId: myUserId, textBoxId: obj.id, isTyping: false })
  }, 2000)
}

const handleBlur = () => {
  socket.emit('user_typing', { userId: myUserId, textBoxId: obj.id, isTyping: false })
  clearTimeout(typingTimerRef.current)
  // Existing save logic...
}
```

---

### 1.7 — Real-Time Content Sync (1s debounce + immediate on blur/Enter)

This should use existing `wb_draw_stroke` / `receive_stroke` for full object commits. Add a separate `text_content_update` event for live content syncing while typing:

**New lightweight event:**
```js
// Client → Server (debounced 1s):
socket.emit('text_content_update', { objectId: obj.id, content, boardId })

// Server → others in room:
socket.on('text_content_update', ({ objectId, content }) => {
  socket.to(boardId).emit('receive_text_content', { objectId, content })
})

// Client — apply update only if not the focused element:
socket.on('receive_text_content', ({ objectId, content }) => {
  if (focusedObjectId !== objectId) {
    updateObjectContent(objectId, content)
  }
})
```

---

## PHASE 2 — COLLABORATOR AVATARS (from Prompt 5)

This is partially implemented per the spec. Verify and complete:

### 2.1 — Avatar Bar Component

**File: `client/src/components/shared/AvatarBar.jsx`**

```jsx
export function AvatarBar({ users }) {
  const visible = users.slice(0, 4)
  const overflow = users.length - 4

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Online indicator */}
      <span style={{ color: '#1D9E75', fontSize: 12, marginRight: 8 }}>
        ● {users.length} online
      </span>

      {/* Stacked avatars */}
      <div style={{ display: 'flex' }}>
        {visible.map((user, i) => (
          <div
            key={user.userId}
            title={user.userName}
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: user.color,
              color: '#0d0d1a',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: i === 0 ? 0 : -8,
              border: '2px solid #0d0d1a',
              cursor: 'default',
              zIndex: visible.length - i,
              position: 'relative',
              transition: 'opacity 300ms ease',
            }}
          >
            {(user.userName || 'A')[0].toUpperCase()}
          </div>
        ))}
        {overflow > 0 && (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(201,168,76,0.15)',
            color: '#C9A84C', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: -8, border: '2px solid #0d0d1a',
          }}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}
```

### 2.2 — Verify AvatarBar is in Whiteboard + Board top bars

Check that `<AvatarBar users={activeUsers} />` is rendered in the top bar of:
- `WhiteboardPage.jsx`
- `Whiteboard.jsx` (embedded/locked version)
- Board/Textboard page top bar

---

## PHASE 3 — CURSOR PRESENCE (Whiteboard only)

Only implement after avatars are confirmed stable.

### 3.1 — Cursor Broadcast

```js
// In whiteboard mouse move handler — throttled to 50ms:
const lastCursorEmit = useRef(0)

const handleMouseMove = (e) => {
  // ... existing logic ...

  const now = Date.now()
  if (now - lastCursorEmit.current > 50) {
    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left - panX) / zoom
    const canvasY = (e.clientY - rect.top - panY) / zoom

    socket.emit('cursor_move', {
      userId: myUserId,
      userName: myUserName,
      color: myColor,
      x: canvasX,
      y: canvasY,
      boardId,
    })
    lastCursorEmit.current = now
  }
}
```

### 3.2 — Server Relay

```js
socket.on('cursor_move', ({ userId, userName, color, x, y }) => {
  const boardId = getUserBoardId(socket.id)
  socket.to(boardId).emit('receive_cursor', { userId, userName, color, x, y })
})
```

### 3.3 — Remote Cursor Component

**File: `client/src/components/whiteboard/RemoteCursor.jsx`**

```jsx
export function RemoteCursor({ user, zoom, panX, panY }) {
  const displayX = user.x * zoom + panX
  const displayY = user.y * zoom + panY

  return (
    <div style={{
      position: 'absolute',
      left: displayX,
      top: displayY,
      pointerEvents: 'none',
      transition: 'left 50ms ease, top 50ms ease',
      zIndex: 1000,
    }}>
      {/* Arrow cursor SVG in user color */}
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path d="M2 2 L2 16 L6 12 L10 18 L12 17 L8 11 L14 11 Z"
          fill={user.color} stroke="#0d0d1a" strokeWidth="1" />
      </svg>
      {/* Name label */}
      <div style={{
        background: user.color,
        color: '#0d0d1a',
        fontSize: 11, fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        marginTop: 2,
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
      }}>
        {user.userName}
      </div>
    </div>
  )
}
```

### 3.4 — Cursor State + Fade-Out

```js
const [remoteCursors, setRemoteCursors] = useState({})
// { [userId]: { ...cursorData, lastSeen: timestamp } }

socket.on('receive_cursor', (cursorData) => {
  if (cursorData.userId === myUserId) return  // never render own cursor

  setRemoteCursors(prev => ({
    ...prev,
    [cursorData.userId]: { ...cursorData, lastSeen: Date.now() }
  }))
})

// Cleanup stale cursors every second
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now()
    setRemoteCursors(prev => {
      const next = { ...prev }
      for (const [id, cursor] of Object.entries(next)) {
        if (now - cursor.lastSeen > 4000) delete next[id]
      }
      return next
    })
  }, 1000)
  return () => clearInterval(interval)
}, [])
```

---

## PHASE 4 — SHARE MODAL

**File: `client/src/components/shared/ShareModal.jsx`**

```jsx
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

export function ShareModal({ boardUrl, isPasswordProtected, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(boardUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    // Backdrop
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      {/* Modal — stop propagation */}
      <div onClick={e => e.stopPropagation()} style={{
        background: '#151524',
        border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: 12,
        padding: 32,
        width: 420,
        maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: '#f5ecd7', fontSize: 18 }}>Share Board</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* URL input + copy */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
            readOnly value={boardUrl}
            style={{ flex: 1, background: '#0d0d1a', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 8, padding: '8px 12px', color: '#f5ecd7', fontSize: 13 }}
          />
          <button onClick={handleCopy} style={{
            background: copied ? '#1D9E75' : 'transparent',
            border: '1px solid rgba(201,168,76,0.4)',
            color: '#C9A84C', borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
          }}>
            {copied ? 'Copied! ✓' : 'Copy'}
          </button>
        </div>

        {/* QR Code */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <QRCodeSVG value={boardUrl} size={160}
            bgColor="transparent" fgColor="#C9A84C" />
        </div>

        {/* Info */}
        <p style={{ fontSize: 12, color: 'rgba(245,236,215,0.5)', textAlign: 'center', margin: 0 }}>
          {isPasswordProtected
            ? 'This board requires a password to unlock'
            : 'Anyone with this link can view and edit'}
        </p>
      </div>
    </div>
  )
}
```

**Install QR package if not already installed:**
```bash
npm install qrcode.react
```

---

## PHASE 5 — COMMAND PALETTE

**File: `client/src/components/shared/CommandPalette.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export function CommandPalette({ boards, whiteboards, onClose }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef()
  const navigate = useNavigate()

  // Combine + filter
  const allItems = [
    ...boards.map(b => ({ ...b, type: 'board', icon: '📝' })),
    ...whiteboards.map(w => ({ ...w, type: 'whiteboard', icon: '🎨' })),
  ]
  const results = query
    ? allItems.filter(i => i.title?.toLowerCase().includes(query.toLowerCase()))
    : allItems.slice(0, 8)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setActiveIndex(0) }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') setActiveIndex(i => Math.min(i + 1, results.length - 1))
    if (e.key === 'ArrowUp') setActiveIndex(i => Math.max(i - 1, 0))
    if (e.key === 'Enter' && results[activeIndex]) {
      navigate(`/${results[activeIndex].type}s/${results[activeIndex].id}`)
      onClose()
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '20vh', zIndex: 2000,
      animation: 'fadeIn 150ms ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '90vw',
        background: '#151524',
        border: '1px solid rgba(201,168,76,0.25)',
        borderRadius: 12,
        overflow: 'hidden',
        animation: 'scaleIn 150ms ease',
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search boards and whiteboards..."
          style={{
            width: '100%', padding: '16px 20px',
            background: 'transparent',
            border: 'none', borderBottom: '1px solid rgba(201,168,76,0.1)',
            color: '#f5ecd7', fontSize: 16, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '20px', color: 'rgba(245,236,215,0.4)', textAlign: 'center' }}>
              No boards found for "{query}"
            </div>
          ) : results.map((item, i) => (
            <div
              key={item.id}
              onClick={() => { navigate(`/${item.type}s/${item.id}`); onClose() }}
              style={{
                padding: '12px 20px',
                display: 'flex', alignItems: 'center', gap: 12,
                background: i === activeIndex ? 'rgba(201,168,76,0.08)' : 'transparent',
                cursor: 'pointer',
                borderLeft: i === activeIndex ? '3px solid #C9A84C' : '3px solid transparent',
              }}
            >
              <span>{item.icon}</span>
              <div>
                <div style={{ color: '#f5ecd7', fontSize: 14, fontWeight: 500 }}>{item.title}</div>
                <div style={{ color: 'rgba(245,236,215,0.4)', fontSize: 11 }}>
                  {item.type} · {formatRelativeTime(item.updatedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Wire Ctrl+K globally** in `App.jsx` or a root layout:

```js
useEffect(() => {
  const handler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setCommandPaletteOpen(true)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

---

## PHASE 6 — TOAST NOTIFICATIONS

**Install:**
```bash
npm install react-hot-toast
```

**Setup in `App.jsx` or root:**
```jsx
import { Toaster } from 'react-hot-toast'

// In JSX:
<Toaster
  position="bottom-right"
  toastOptions={{
    style: {
      background: '#151524',
      color: '#f5ecd7',
      border: '1px solid rgba(201,168,76,0.3)',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
    },
    success: { iconTheme: { primary: '#C9A84C', secondary: '#151524' } },
    error: { style: { border: '1px solid rgba(237,147,177,0.4)' } },
  }}
/>
```

**Replace all `alert()` calls with:**
```js
import toast from 'react-hot-toast'

toast.success('Board created successfully')
toast.error('Failed to save')
toast('Moved to trash', { icon: '🗑️' })
toast.success('Restored from trash')
toast.success('Starred')
toast('Reconnected', { icon: '🟢' })
```

**Grep for remaining `alert(` calls:**
```bash
grep -r "alert(" client/src/
```

---

## PHASE 7 — CANVAS GRID BACKGROUND

**File: `client/src/components/whiteboard/CanvasGrid.jsx`**

```jsx
// Renders as a background canvas layer behind the drawing canvas
export function CanvasGrid({ mode, width, height, zoom, panX, panY, isDark }) {

  if (mode === 'none') return null

  const dotColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'

  if (mode === 'dots') {
    const spacing = 24
    // Generate SVG dot pattern
    return (
      <svg
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        width={width} height={height}
      >
        <defs>
          <pattern id="dots" x={panX % spacing} y={panY % spacing}
            width={spacing * zoom} height={spacing * zoom}
            patternUnits="userSpaceOnUse">
            <circle cx={spacing * zoom / 2} cy={spacing * zoom / 2}
              r={1} fill={dotColor} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>
    )
  }

  if (mode === 'lines') {
    const spacing = 32 * zoom
    return (
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        width={width} height={height}>
        <defs>
          <pattern id="lines" x={panX % spacing} y={panY % spacing}
            width={spacing} height={spacing} patternUnits="userSpaceOnUse">
            <path d={`M ${spacing} 0 L 0 0 0 ${spacing}`}
              fill="none" stroke={dotColor} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lines)" />
      </svg>
    )
  }
}
```

**Store preference:**
```js
const [gridMode, setGridMode] = useState(
  () => localStorage.getItem(`bb_grid_${boardId}`) || 'none'
)
const cycleGrid = () => {
  const modes = ['none', 'dots', 'lines']
  const next = modes[(modes.indexOf(gridMode) + 1) % modes.length]
  setGridMode(next)
  localStorage.setItem(`bb_grid_${boardId}`, next)
}
```

---

## PHASE 8 — SKELETON LOADERS

**File: `client/src/components/shared/SkeletonCard.jsx`**

```jsx
export function SkeletonCard() {
  return (
    <div style={{
      background: '#151524',
      border: '1px solid rgba(201,168,76,0.1)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        height: 120,
        background: 'linear-gradient(90deg, rgba(201,168,76,0.05) 25%, rgba(201,168,76,0.1) 50%, rgba(201,168,76,0.05) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
      <div style={{ padding: '12px 16px' }}>
        <div style={{ height: 14, width: '60%', borderRadius: 4, marginBottom: 8,
          background: 'rgba(201,168,76,0.08)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ height: 10, width: '40%', borderRadius: 4,
          background: 'rgba(201,168,76,0.05)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      </div>
    </div>
  )
}
```

**Global CSS (add to index.css):**
```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## PHASE 9 — MOBILE BOTTOM NAV

**File: `client/src/components/shared/MobileNav.jsx`**

```jsx
import { Home, Layout, PenTool, Star, Menu } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Layout, label: 'Boards', path: '/boards' },
  { icon: PenTool, label: 'Draw', path: '/new-whiteboard' },
  { icon: Star, label: 'Starred', path: '/starred' },
  { icon: Menu, label: 'More', path: '/menu' },
]

export function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav style={{
      display: 'none', // shown via CSS media query
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 56, zIndex: 100,
      background: '#0d0d1a',
      borderTop: '1px solid rgba(201,168,76,0.15)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}
    className="mobile-nav">
      {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
        const isActive = location.pathname.startsWith(path)
        return (
          <button key={path} onClick={() => navigate(path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: isActive ? '#C9A84C' : 'rgba(245,236,215,0.3)',
            gap: 2,
          }}>
            <Icon size={20} />
            {isActive && <span style={{ fontSize: 10 }}>{label}</span>}
          </button>
        )
      })}
    </nav>
  )
}
```

**CSS:**
```css
@media (max-width: 768px) {
  .mobile-nav { display: flex !important; }
  body { padding-bottom: 56px; }
}
```

---

## SAFETY AUDIT REPORT

### ✅ Architecture Checks

| Check | Status | Action |
|---|---|---|
| Frontend has no `.env` secrets | **Verify** | Run grep audit in Phase 0 |
| API base URL from env var, not hardcoded | **Verify** | Check `api.js` / `socket.js` |
| No Mongoose models in `client/src/` | **Verify** | Find + move if found |
| No backend route files in `client/src/` | **Verify** | Find + move if found |
| `.gitignore` covers `.env` | **Verify** | Check `.gitignore` |
| No `console.log` leaking socket data | **Verify** | Grep for sensitive logs |

### ✅ Socket Event Safety

| Event | Risk | Mitigation |
|---|---|---|
| `user_typing` | Spam if not throttled | Throttle to 500ms on client |
| `cursor_move` | Spam if not throttled | Throttle to 50ms on client |
| `join_board` | Anyone can join any room | Acceptable — no auth per spec |
| `wb_draw_stroke` | Malformed payloads | Validate `type` field server-side |
| `text_content_update` | Content flooding | Debounce 1s client-side |

### ✅ Data Safety

| Risk | Mitigation |
|---|---|
| `authorColor` from client could be spoofed | Acceptable — cosmetic only, no security impact |
| `userName` from localStorage unverified | Acceptable per spec — no auth system |
| Room user list lives in memory | Server restart clears presence — acceptable |
| QR code exposes board URL | URL is already shareable — no new risk |

### ✅ Performance Checks

| Check | Expected |
|---|---|
| Cursor events: max rate | 20/s (every 50ms) |
| Typing events: max rate | 2/s (every 500ms) |
| Text sync: max rate | 1/s debounced |
| Avatar re-renders | Only on `user_list` change (not every cursor move) |
| Grid SVG redraws | Only on zoom/pan/mode change |

### ✅ Known Risks to Monitor

1. **Memory leak — typing timers**: Ensure `clearTimeout` on all typing timer refs when component unmounts
2. **Cursor cleanup**: Stale cursor cleanup interval must be cleared on unmount
3. **Socket listener duplication**: All `socket.on()` calls must have corresponding `socket.off()` in cleanup functions (missing these causes duplicate event handlers on re-render)
4. **roomUsers memory growth**: Server-side roomUsers object grows indefinitely if boards are visited but not left cleanly. Consider a periodic cleanup of empty rooms.

---

## BUILD ORDER (Follow Strictly)

```
Phase 0  → Frontend file audit (30 min)
Phase 1  → User attribution system — server color assignment + labels (2-3 hrs)
Phase 2  → Collaborator avatars (verify/complete — 1 hr)
Phase 3  → Cursor presence (only after Phase 2 stable — 1-2 hrs)
Phase 4  → Share modal + QR code (1 hr)
Phase 5  → Command palette (1-2 hrs)
Phase 6  → Toast notifications — replace all alert() (30 min)
Phase 7  → Canvas grid background (30 min)
Phase 8  → Skeleton loaders (30 min)
Phase 9  → Mobile bottom nav (30 min)
```

**Total estimated: 8-12 hours of focused implementation**

---

## FILES TO CREATE (New)

```
client/src/hooks/useUserColor.js
client/src/components/whiteboard/AttributionLabel.jsx
client/src/components/whiteboard/RemoteCursor.jsx
client/src/components/whiteboard/CanvasGrid.jsx
client/src/components/shared/AvatarBar.jsx
client/src/components/shared/ShareModal.jsx
client/src/components/shared/CommandPalette.jsx
client/src/components/shared/SkeletonCard.jsx
client/src/components/shared/MobileNav.jsx
```

## FILES TO MODIFY (Existing)

```
server/socket/whiteboardHandlers.js   ← add user color assignment, typing relay, cursor relay
client/src/components/whiteboard/TextObject.jsx   ← add attribution label + typing emit
client/src/pages/WhiteboardPage.jsx   ← add avatars, cursors, grid, share modal
client/src/pages/Whiteboard.jsx       ← same as above (keep parity)
client/src/App.jsx                    ← add Toaster, Ctrl+K handler, CommandPalette
client/src/index.css                  ← shimmer keyframe, scrollbar styles, focus-visible
```

---

## POST-BUILD VERIFICATION CHECKLIST

```
□ Open 3 browser tabs on same whiteboard
□ Each tab shows different color avatar
□ Each tab's text objects show correct attribution label
□ Typing in tab 1 shows ✍️ indicator in tabs 2 and 3
□ Content syncs within 1 second between tabs
□ Cursor appears in other tabs, fades after 4s of stillness
□ Share modal opens, QR code renders, copy works
□ Ctrl+K opens command palette, arrow keys navigate, Enter opens board
□ No alert() calls remain — all replaced with toasts
□ Grid toggles: None → Dots → Lines
□ Mobile: bottom nav visible at 375px, no overflow
□ npm run build — zero errors
□ grep -r "MONGO_URI\|JWT_SECRET" client/src/ → zero results
```
