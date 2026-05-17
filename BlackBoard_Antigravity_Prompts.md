# BlackBoard — Revised Antigravity Build Prompts
# Updated based on architectural review feedback
# Version 2.0

---

## ⚠️ CRITICAL RULES — Read Before Starting Any Prompt

1. **Stability over features** — fix bugs before adding anything new
2. **One prompt at a time** — test fully before moving to next
3. **No Redux, no Zustand** — local state + minimal context only
4. **No extra MongoDB collections** — compute recent/starred/trash from existing data
5. **Normalize all API responses** — unified `{ id, type, title, updatedAt, starred }` format
6. **Subtle glassmorphism only** — mostly solid surfaces, blur used sparingly
7. **Coordinate math must account for zoom** — always divide by zoom factor

---

## BUILD ORDER (non-negotiable)

```
Step 0 → Stabilize whiteboard (before anything else)
Step 1 → Sidebar + DashboardLayout shell
Step 2 → Unified board API + board cards
Step 3 → Star + Soft delete (Trash)
Step 4 → Shapes + Sticky notes (simplified)
Step 5 → Zoom + Pan
Step 6 → Rich text editor (TipTap, no Yjs)
Step 7 → Presence + Avatars + Share
Step 8 → Command palette
Step 9 → Final polish
```

---

---

# PROMPT 0 — Whiteboard Stabilization (DO THIS FIRST)

> Before building anything new, perform a full stability audit of the existing whiteboard system. Do NOT add any features. Only fix bugs.
>
> **Test and fix these specific things:**
>
> **1. Object system audit:**
> - Verify ALL object types (pen strokes, text, images) share a unified structure:
>   ```js
>   { id, type, x, y, width, height, ...typeSpecificFields }
>   ```
> - If any object type does NOT follow this structure, refactor it to match
> - This unified structure is required before shapes and sticky notes can be added
>
> **2. Drag and resize audit:**
> - Test dragging text objects — does it work smoothly without jitter?
> - Test dragging image objects — does aspect ratio hold?
> - Test resize handles on all object types — do corners respond correctly?
> - Fix any jitter, jumping, or incorrect positioning
>
> **3. Undo/Redo audit:**
> - Test undo after: drawing a stroke, adding text, adding image, moving an object
> - Test redo after undoing each of the above
> - Verify undo/redo syncs to all connected users via Socket.io
> - Fix any cases where undo produces incorrect state
>
> **4. Real-time sync audit:**
> - Open same whiteboard in TWO browser tabs
> - Draw in tab 1 → verify appears in tab 2
> - Add text in tab 1 → verify in tab 2
> - Move object in tab 1 → verify in tab 2
> - Undo in tab 1 → verify correct state in tab 2
> - Fix any sync inconsistencies
>
> **5. Performance audit:**
> - Add 20+ objects to whiteboard
> - Verify no lag when drawing
> - Verify no lag when moving objects
> - If lag exists: profile and fix the render loop
>
> **6. Edge cases:**
> - What happens if two users move the same object simultaneously? Document the behavior.
> - What happens if socket disconnects mid-draw? Verify graceful recovery.
> - What happens if MongoDB save fails? Verify no data corruption.
>
> **After fixing everything:**
> - Write a brief summary of what was fixed
> - Confirm the object system is unified and ready for new object types
> - Only then proceed to Prompt 1

---

---

# PROMPT 1 — Sidebar + Dashboard Shell

> Redesign the navigation and dashboard of BlackBoard to feel like a premium workspace (Notion/Linear/Eraser.io aesthetic). Do NOT break any existing functionality.
>
> ---
>
> ## IMPORTANT ARCHITECTURAL RULES FOR THIS PROMPT
>
> - Use local component state only — no global state management
> - Username comes from `localStorage.getItem('bb_user_name')` — no auth system
> - Glassmorphism: use SPARINGLY — mostly solid surfaces `#0d0d1a` and `#151524`
> - Sidebar navigation: maximum 6 items — keep it compact and intentional
> - Do NOT animate aggressively — subtle transitions only
>
> ---
>
> ## 1. NEW COMPONENT: `DashboardLayout.jsx`
>
> Create a layout wrapper used by all non-canvas pages:
> - Fixed left sidebar (240px) + main content area (flex-1)
> - Sidebar collapsible to 48px icon-only mode via toggle button
> - Collapse state stored in localStorage
> - Responsive: sidebar hidden on mobile (<768px), accessible via hamburger
> - Transition: `width 250ms ease` only — no aggressive animations
>
> ```
> Layout structure:
> ┌─────────────┬──────────────────────────────┐
> │   Sidebar   │   Top bar                    │
> │   240px     │   ──────────────────────     │
> │             │   Page content               │
> │             │                              │
> └─────────────┴──────────────────────────────┘
> ```
>
> ---
>
> ## 2. SIDEBAR CONTENT
>
> **Top section:**
> - Logo: BlackBoard icon + wordmark in gold `#C9A84C`
> - Collapse toggle: `ChevronLeft` / `ChevronRight` Lucide icon
> - Search bar (placeholder, clicking opens Command Palette later)
>
> **Navigation — exactly 6 items:**
> ```
> Home          (Lucide: Home)
> All Boards    (Lucide: Layout)
> Whiteboards   (Lucide: PenTool)
> Starred       (Lucide: Star)
> Trash         (Lucide: Trash2)
> ─────────────────────────────
> Admin         (Lucide: Shield) — only show if JWT in localStorage
> ```
>
> Active state: gold left border `3px solid #C9A84C`, gold text, background `rgba(201,168,76,0.08)` — NO blur
>
> **Bottom section:**
> - Username from localStorage
> - Theme toggle (dark/light)
> - Logout button (clears localStorage, redirects to landing)
>
> **Sidebar colors:**
> ```
> Dark:  background #0d0d1a, border-right 1px solid rgba(201,168,76,0.12)
> Light: background #fdf6ee, border-right 1px solid rgba(201,168,76,0.2)
> ```
>
> ---
>
> ## 3. TOP BAR (inside main content area)
>
> - Left: current page title (dynamic, matches active nav item)
> - Right: `+ New Board` gold button + `+ New Whiteboard` ghost button
> - Height: 56px, border-bottom: `1px solid rgba(201,168,76,0.1)`
> - Background: same as page background — NO blur or glassmorphism here
>
> ---
>
> ## 4. HOME/DASHBOARD PAGE
>
> **Welcome header:**
> - `Welcome back, [name from localStorage] 👋` — Playfair Display font
> - Subtitle: `Create, collaborate, and bring ideas to life.` — muted text
>
> **Quick Actions (3 cards in a row):**
> ```
> 🎨 New Whiteboard   — "Infinite canvas for drawing and brainstorming"
> 📝 New Textboard    — "Rich text editor for notes and docs"
> 📎 Upload to Board  — "Add files and images to a board"
> ```
> Card style: solid background `#151524` (dark) / `#fff8f0` (light), gold border on hover `rgba(201,168,76,0.4)`, NO blur
>
> **Recent Boards grid:**
> - Title: "Recent Boards" + "View all →" link
> - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, gap 16px
> - Shows last 6 boards sorted by `lastOpenedAt`
> - See Board Card spec below
>
> **Recent Whiteboards grid:**
> - Same layout, below Recent Boards
> - Shows last 6 whiteboards sorted by `lastOpenedAt`
>
> ---
>
> ## 5. BOARD CARD COMPONENT (`BoardCard.jsx`)
>
> Reusable card used in all grid views:
>
> **Card anatomy:**
> ```
> ┌─────────────────────────────┐
> │  Thumbnail (gradient top)   │ ← 120px height colored gradient
> ├─────────────────────────────┤
> │  ★  Board Name         ⋯   │ ← star icon left, 3-dot menu right
> │  [Whiteboard] · 2h ago      │ ← type badge + last updated
> └─────────────────────────────┘
> ```
>
> **Thumbnail gradients:**
> - Whiteboard: `linear-gradient(135deg, #1a1530, #2d1f4a)` with lavender tint
> - Textboard: `linear-gradient(135deg, #1a1a0d, #2a2010)` with gold tint
>
> **Interactions:**
> - Hover: `translateY(-3px)`, border brightens to `rgba(201,168,76,0.5)` — transition 200ms
> - Star icon: click toggles starred state, calls `PATCH /api/boards/:id/star`
> - Three-dot menu: shows dropdown with Open, Rename, Move to Trash
> - Click card → navigate to board
>
> **Card style:**
> - Background: `#151524` (dark) / `#fff8f0` (light)
> - Border: `1px solid rgba(201,168,76,0.15)`
> - Border-radius: 10px
> - NO glassmorphism
>
> ---
>
> ## 6. ALL BOARDS PAGE
>
> - Unified grid of all non-deleted boards AND whiteboards
> - Sort controls: Recently Updated | Name A-Z | Date Created
> - Filter tabs: All | Textboards | Whiteboards | Starred
> - Uses same BoardCard component
> - Empty state: Layout icon (large, muted) + "No boards yet" + create button
>
> ---
>
> ## 7. STARRED PAGE
>
> - Grid of all boards/whiteboards where `starred: true`
> - Same BoardCard component
> - Empty state: Star icon + "Nothing starred yet" + instruction text
>
> ---
>
> ## 8. TRASH PAGE
>
> - Grid of all boards/whiteboards where `isDeleted: true`
> - BoardCard shows with reduced opacity (0.7)
> - Context menu: Restore | Permanently Delete
> - Empty state: Trash2 icon + "Trash is empty"
>
> ---
>
> ## 9. BACKEND CHANGES
>
> **Schema additions (Board.js AND Whiteboard.js):**
> ```js
> starred:      { type: Boolean, default: false }
> lastOpenedAt: { type: Date, default: Date.now }
> isDeleted:    { type: Boolean, default: false }
> ```
>
> **New routes — compute from existing data, NO new collections:**
> ```
> GET    /api/unified/recent     → last 6 boards + last 6 whiteboards by lastOpenedAt
> GET    /api/unified/starred    → all starred boards + whiteboards
> GET    /api/unified/trash      → all isDeleted boards + whiteboards
> GET    /api/unified/all        → all non-deleted boards + whiteboards
> PATCH  /api/boards/:id/star        → toggle starred
> PATCH  /api/whiteboards/:id/star   → toggle starred
> PATCH  /api/boards/:id/trash       → toggle isDeleted (soft delete)
> PATCH  /api/whiteboards/:id/trash  → toggle isDeleted
> ```
>
> **CRITICAL — normalize all API responses:**
> Every item returned must follow this exact shape:
> ```js
> {
>   id,           // boardId or whiteboardId
>   type,         // 'board' or 'whiteboard'
>   title,        // boardName or title
>   updatedAt,    // lastOpenedAt
>   createdAt,
>   starred,
>   isDeleted
> }
> ```
> Do NOT send raw Mongoose documents to the frontend.
>
> **Update `lastOpenedAt`** on every `GET /api/boards/:id` and `GET /api/whiteboards/:id` request.
>
> ---
>
> ## 10. RESPONSIVE BEHAVIOR
>
> - Desktop (>1024px): sidebar 240px always visible
> - Tablet (768-1024px): sidebar collapsed to 48px by default
> - Mobile (<768px): sidebar hidden, hamburger button in top bar opens it as overlay
>
> ---
>
> ## FINAL RULES
> - Keep ALL existing routes and board/whiteboard functionality intact
> - Keep existing theme toggle working
> - Use Lucide React for all icons — no emoji in nav
> - After building: list every new file created and every modified file
> - Run `npm run dev` and confirm zero console errors before finishing

---

---

# PROMPT 2 — Shapes + Sticky Notes (Simplified & Stable)

> Add shapes and sticky notes to the whiteboard. Keep the implementation focused and stable — do NOT implement connectors or rubber-band multi-select in this prompt (those are risky and can be added later).
>
> ---
>
> ## CRITICAL ARCHITECTURAL REQUIREMENT
>
> ALL new objects MUST follow the unified object structure:
> ```js
> {
>   id,           // nanoid()
>   type,         // 'shape' | 'sticky'
>   x,
>   y,
>   width,
>   height,
>   ...typeSpecificFields
> }
> ```
> This ensures undo/redo, sync, and selection work correctly for all object types.
>
> ---
>
> ## TOOL 1 — SHAPES
>
> Add a Shapes tool to the toolbar (Lucide: `Square` icon):
>
> **Shapes available:**
> - Rectangle
> - Circle / Ellipse
> - Triangle
> - Diamond
>
> Show as a small popover when Shapes tool is clicked.
>
> **Drawing behavior:**
> - Click and drag on canvas → draws shape
> - Shape preview shown during drag (dashed border)
> - On mouse release → shape becomes a DOM overlay object
>
> **Shape object structure:**
> ```js
> {
>   id,
>   type: 'shape',
>   shapeType: 'rect' | 'circle' | 'triangle' | 'diamond',
>   x, y, width, height,
>   color,        // border color, follows current selected color
>   fill,         // 'transparent' by default
>   label: ''     // optional text inside shape
> }
> ```
>
> **Shape DOM overlay:**
> - Renders as a positioned div over the canvas
> - Uses CSS border-radius/clip-path for circle/triangle/diamond shapes
> - Resize handles on 4 corners (drag to resize)
> - Context menu on hover: Move | Resize | Change Color | Fill | Delete
> - Double click → editable label appears inside shape (contentEditable)
>
> **Coordinate fix for zoom:**
> When placing shape, calculate:
> ```js
> const canvasX = (mouseX - panX) / zoom
> const canvasY = (mouseY - panY) / zoom
> ```
> Use these values for x, y — NOT raw mouse coordinates.
>
> ---
>
> ## TOOL 2 — STICKY NOTES
>
> Add a Sticky Note tool to the toolbar (Lucide: `StickyNote` icon):
>
> **Behavior:**
> - Click anywhere on canvas → places a sticky note at that position
> - Default size: 160px × 160px
> - Editable immediately on placement (contentEditable focused)
>
> **Sticky note object structure:**
> ```js
> {
>   id,
>   type: 'sticky',
>   x, y,
>   width: 160, height: 160,
>   color: '#C9A84C',   // background color
>   content: '',
>   rotation: 0         // keep 0 for now — no random rotation (causes sync issues)
> }
> ```
>
> **Sticky note appearance:**
> - Colored background (follows selected color from palette)
> - Color palette for stickies: gold `#C9A84C`, blush pink `#ED93B1`, lavender `#AFA9EC`, mint `#6EC9A8`, white `#FFFEF0`
> - Font: Inter 13px, text color `#2a1f0e` (always dark regardless of theme)
> - Subtle drop shadow: `0 2px 8px rgba(0,0,0,0.2)`
> - NO random rotation — keep at 0deg (rotation causes coordinate calculation bugs)
>
> **Sticky note interactions:**
> - Drag to move (same as existing ImageObject drag)
> - Resize by dragging bottom-right corner
> - Context menu: Edit | Change Color | Delete
> - Click outside → deselect and save content
>
> ---
>
> ## UNDO/REDO FOR NEW OBJECTS
>
> Ensure undo/redo works for:
> - Adding a shape → undo removes it
> - Adding a sticky note → undo removes it
> - Moving a shape → undo returns it to previous position
> - Deleting a shape → undo restores it
>
> Use the EXISTING undo stack — do NOT create a new one.
>
> ---
>
> ## REAL-TIME SYNC
>
> Use EXISTING Socket.io events — do NOT add new event names:
> ```
> wb_draw_stroke    → send new shape/sticky object
> wb_receive_stroke → receive and render on other clients
> wb_undo           → existing undo sync
> ```
>
> The object `type` field distinguishes between strokes, shapes, and stickies.
>
> ---
>
> ## TOOLBAR UPDATE
>
> Updated toolbar order:
> ```
> Select | Pan | Pen | Shapes▾ | Sticky | Eraser | Text | Image | ─── | Color | Size | ─── | Undo | Redo
> ```
>
> Keep toolbar clean — Shapes opens a popover, no additional toolbar expansion.
>
> ---
>
> ## WHAT TO SKIP IN THIS PROMPT
>
> ❌ Connector/arrow tool — too complex, implement separately later
> ❌ Rubber-band multi-select — too complex, implement separately later
> ❌ Keyboard shortcuts — add in Polish prompt
> ❌ Shape-to-shape connections — skip entirely for now
>
> ---
>
> ## FINAL RULES
> - Test with two browser tabs — shapes and stickies must sync in real time
> - Test undo/redo for all new object types
> - Verify coordinate calculation accounts for zoom (even though zoom isn't built yet — use zoom=1 placeholder)
> - Run `npm run dev` — zero console errors

---

---

# PROMPT 3 — Zoom + Pan (No Minimap for Now)

> Add zoom and pan to the whiteboard canvas. This is foundational — must be done carefully. Skip the minimap for now (adds complexity for little gain at this stage).
>
> ---
>
> ## ⚠️ MOST IMPORTANT RULE IN THIS PROMPT
>
> When zoom is applied via CSS transform, ALL mouse coordinates must be normalized:
> ```js
> const canvasX = (mouseX - canvasRect.left - panX) / zoom
> const canvasY = (mouseY - canvasRect.top - panY) / zoom
> ```
> Apply this EVERYWHERE mouse position is used:
> - Drawing pen strokes
> - Placing shapes/stickies/text
> - Dragging objects
> - Resize handles
> - Selection
>
> Failure to normalize = broken dragging, broken placement, broken resize.
>
> ---
>
> ## ZOOM STATE
>
> ```js
> const [zoom, setZoom] = useState(1)      // 1 = 100%
> const [panX, setPanX] = useState(0)
> const [panY, setPanY] = useState(0)
> ```
>
> Apply via CSS transform on the canvas container:
> ```js
> style={{
>   transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
>   transformOrigin: '0 0'
> }}
> ```
>
> ---
>
> ## ZOOM CONTROLS
>
> Add to bottom-right corner of whiteboard:
> ```
> [ − ]  [ 75% ]  [ + ]  [ Fit ]
> ```
>
> - `−`: zoom out 10%, minimum 10% (`zoom = Math.max(0.1, zoom - 0.1)`)
> - `+`: zoom in 10%, maximum 400% (`zoom = Math.min(4, zoom + 0.1)`)
> - Percentage display: shows current zoom, click to type exact value
> - `Fit`: calculate zoom to fit all objects in viewport, center them
>
> **Zoom centered on cursor (Ctrl + scroll):**
> ```js
> const zoomAt = (mouseX, mouseY, delta) => {
>   const newZoom = Math.max(0.1, Math.min(4, zoom + delta))
>   const zoomRatio = newZoom / zoom
>   setPanX(mouseX - zoomRatio * (mouseX - panX))
>   setPanY(mouseY - zoomRatio * (mouseY - panY))
>   setZoom(newZoom)
> }
> ```
>
> **Zoom style:**
> ```
> Dark:  background #151524, text #C9A84C, border rgba(201,168,76,0.2)
> Light: background #fff8f0, text #C9A84C
> Border-radius: 8px, padding: 6px 12px
> ```
>
> ---
>
> ## PAN BEHAVIOR
>
> Three ways to pan:
>
> **1. Space + drag:**
> - Hold Space → cursor changes to `grab`
> - Mouse down → cursor changes to `grabbing`, start tracking drag delta
> - Mouse move → update panX, panY by drag delta
> - Mouse up / Space release → stop panning
>
> **2. Middle mouse button drag:**
> - `onMouseDown` with `event.button === 1` → start pan
>
> **3. Pan tool active (H key or toolbar):**
> - Left click drag → pan
>
> ---
>
> ## KEYBOARD SHORTCUTS FOR ZOOM/PAN
>
> ```
> Ctrl + =     → Zoom in
> Ctrl + -     → Zoom out
> Ctrl + 0     → Reset to 100%
> Ctrl + Shift + F  → Fit to view
> Space + drag → Pan
> ```
>
> ---
>
> ## FIT TO VIEW
>
> Calculate bounding box of all objects, then:
> ```js
> const fitZoom = Math.min(
>   viewportWidth / (contentWidth + 80),
>   viewportHeight / (contentHeight + 80),
>   1  // never zoom in above 100% when fitting
> )
> ```
> Center the content in the viewport.
>
> ---
>
> ## WHAT TO SKIP IN THIS PROMPT
>
> ❌ Minimap — adds complexity, skip for now
> ❌ Canvas grid background — add in Polish prompt
> ❌ Minimap dragging — skip entirely
>
> ---
>
> ## FINAL RULES
> - After building: test EVERY existing tool still works correctly with zoom at 50%, 100%, 200%
> - Test drag object at 200% zoom — must not jump
> - Test place sticky note at 150% zoom — must appear at correct position
> - Test undo after zoomed operations — must work correctly
> - Two-tab sync must still work after zoom changes

---

---

# PROMPT 4 — Rich Text Editor (TipTap, No Yjs)

> Upgrade the existing Note/Textboard editor to use TipTap. Use debounced JSON sync — do NOT use Yjs or TipTap's collaboration extension.
>
> ---
>
> ## ⚠️ CRITICAL — DO NOT USE THESE
>
> ❌ `@tiptap/extension-collaboration` — introduces Yjs, way too complex
> ❌ `@tiptap/extension-collaboration-cursor` — same reason
> ❌ Any CRDT library
>
> Use debounced JSON sync instead — simple, reliable, good enough.
>
> ---
>
> ## INSTALL
>
> ```bash
> npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
> npm install @tiptap/extension-placeholder
> npm install @tiptap/extension-color @tiptap/extension-text-style
> npm install @tiptap/extension-highlight
> npm install @tiptap/extension-task-list @tiptap/extension-task-item
> npm install @tiptap/extension-image @tiptap/extension-link
> npm install @tiptap/extension-typography
> ```
>
> ---
>
> ## EDITOR SETUP
>
> ```js
> const editor = useEditor({
>   extensions: [
>     StarterKit,
>     Placeholder.configure({ placeholder: "Start writing, or type '/' for commands..." }),
>     Typography,
>     Color, TextStyle,
>     Highlight.configure({ multicolor: true }),
>     TaskList, TaskItem.configure({ nested: true }),
>     Image, Link,
>   ],
>   content: board.content,   // load from MongoDB
>   onUpdate: ({ editor }) => {
>     debouncedSave(editor.getJSON())   // debounce 2 seconds
>   }
> })
> ```
>
> ---
>
> ## TOOLBAR
>
> Fixed toolbar above editor (NOT floating to avoid complexity):
>
> ```
> B  I  U  S  |  H1  H2  H3  |  •  1.  ☑  |  "  ─  |  </>  |  🔗
> ```
>
> All using TipTap commands via `editor.chain().focus()...`
>
> **Bubble toolbar (floating on text selection):**
> - Appears above selected text
> - Options: Bold | Italic | Link | Highlight | Code
> - Simple, small, 5 options maximum
>
> ---
>
> ## SLASH COMMANDS
>
> Type `/` anywhere → show a simple dropdown menu:
> ```
> /h1       → Heading 1
> /h2       → Heading 2
> /h3       → Heading 3
> /bullet   → Bullet list
> /todo     → Task list
> /code     → Code block
> /quote    → Blockquote
> /divider  → Horizontal rule
> ```
>
> Implementation: listen for `/` keydown → show positioned dropdown → filter as user types → apply on Enter/click.
>
> ---
>
> ## SECTIONS PANEL (KEEP SIMPLE)
>
> Collapsible left panel (180px) showing H1 and H2 headings:
> - Extract headings from `editor.getJSON()` on every update
> - Render as clickable list items
> - Click → `editor.commands.scrollIntoView()` to that heading
> - Toggle button to show/hide panel
> - Keep it simple — just a plain list, no drag-to-reorder
>
> ---
>
> ## REAL-TIME SYNC (DEBOUNCED)
>
> ```js
> // On editor update (debounced 2 seconds):
> socket.emit('text_update', {
>   content: editor.getJSON()   // send full JSON, not delta
> })
>
> // On receive:
> socket.on('receive_update', ({ content }) => {
>   // Only update if editor is not focused (avoid fighting the user)
>   if (!editor.isFocused) {
>     editor.commands.setContent(content, false)
>   }
> })
> ```
>
> This is simple and works well for non-simultaneous editing.
>
> ---
>
> ## AUTO-SAVE INDICATOR
>
> Show in top bar:
> - While typing: `Saving...` in muted text
> - After save completes: `Saved ✓` in gold, fades after 2 seconds
>
> ---
>
> ## STYLING
>
> ```
> Editor container max-width:   720px, centered
> Editor padding:               40px 48px
> Background dark:              #0d0d1a
> Background light:             #fdf6ee
> Text dark:                    #f5ecd7
> Text light:                   #2a1f0e
> Heading color:                same as text, bolder
> Blockquote:                   border-left 4px solid #C9A84C, padding-left 16px, italic
> Code block bg dark:           #151524
> Code block bg light:          #fff8f0
> Code font:                    JetBrains Mono, 13px
> Link color:                   #C9A84C, underlined
> Task checkbox:                gold accent when checked
> Placeholder:                  muted color, italic
> ```
>
> ---
>
> ## BOTTOM BAR
>
> Below editor, small text:
> ```
> [word count] words · [char count] characters
> ```
>
> ---
>
> ## WHAT TO SKIP IN THIS PROMPT
>
> ❌ Collaborator cursors in TipTap — too complex
> ❌ Export as Markdown — add later if time
> ❌ Inline comments — skip
>
> ---
>
> ## FINAL RULES
> - Existing board content must load correctly
> - Auto-save every 2 seconds while typing
> - Test: type in tab 1, content appears in tab 2 after 2 second debounce
> - Run `npm run dev` — zero console errors

---

---

# PROMPT 5 — Presence, Avatars & Share

> Add user presence (avatars, online count) and a share modal. Keep cursor presence OPTIONAL — implement avatars first, cursors only if avatars are stable.
>
> ---
>
> ## 1. USERNAME PROMPT
>
> On first visit to ANY board or whiteboard:
> - If `localStorage.getItem('bb_user_name')` is null → show modal
> - Modal: friendly, centered, glassmorphism card
> - Title: "What should we call you?"
> - Input: name field, autofocused
> - Button: "Let's go" (gold)
> - Skip link: "Skip — use Anonymous"
> - On confirm: `localStorage.setItem('bb_user_name', name)`
> - Modal never shows again after name is set
>
> ---
>
> ## 2. COLLABORATOR AVATARS
>
> Show in top bar of every board/whiteboard — right side, before Share button:
>
> **Avatar circle:**
> - 32px diameter circle
> - Background: one of 5 colors assigned by userId hash:
>   `['#C9A84C', '#ED93B1', '#AFA9EC', '#6EC9A8', '#E8956D']`
> - Shows user initials (first letter of name, uppercase)
> - Font: Inter 13px bold, text color `#0d0d1a`
>
> **Stacked display:**
> - Max 4 avatars visible, stacked with -8px margin
> - If 5+ users: show `+N` circle in muted style
> - Tooltip on hover: full username
> - Fade in on join, fade out on leave (300ms transition)
>
> **Socket events:**
> ```js
> // On join board:
> socket.emit('user_joined', { userName, color, boardId })
>
> // Server broadcasts to room:
> socket.on('user_list', ({ users }) => setActiveUsers(users))
>
> // On disconnect (server detects):
> socket.on('user_left', ({ userId }) => removeUser(userId))
> ```
>
> **Online indicator:**
> - Left of avatars: `● 3 online` in `#1D9E75`
> - Updates in real time
>
> ---
>
> ## 3. CURSOR PRESENCE (Whiteboard only — implement AFTER avatars work)
>
> ⚠️ Only implement this if avatars are stable and working.
>
> **Cursor broadcast — throttled to every 50ms (20fps):**
> ```js
> socket.emit('cursor_move', {
>   userId, userName, color,
>   x: canvasX,   // normalized for zoom
>   y: canvasY
> })
> ```
>
> **Cursor display:**
> - Each remote user: a 20px arrow cursor SVG in their color
> - Name label: small pill below cursor, same color, white text, 11px
> - CSS transition: `left 50ms ease, top 50ms ease` for smooth movement
> - Fade out after 4 seconds of no movement
> - Implemented as absolutely positioned divs over the canvas
>
> **IMPORTANT:**
> - Cursor coordinates must account for zoom: `displayX = x * zoom + panX`
> - Never render your own cursor (filter by userId)
> - Throttle STRICTLY — 50ms minimum between broadcasts
>
> ---
>
> ## 4. SHARE MODAL
>
> `Share` button in top bar (Lucide: `Share2`, gold border, gold text):
>
> **Modal contents:**
> - Board link: full URL in a text input (readonly)
> - Copy button: copies to clipboard, shows `Copied! ✓` for 2 seconds
> - QR code: install `npm install qrcode.react`, render `<QRCodeSVG value={boardUrl} size={160} />`
> - Privacy info: "Anyone with this link can view and edit"
> - If board has password: "This board requires a password to unlock"
>
> **Modal style:**
> - Solid background `#151524` (dark) / `#fff8f0` (light) — NO excessive blur
> - Gold border `1px solid rgba(201,168,76,0.3)`
> - Max width: 420px, centered
> - Close button top right
>
> ---
>
> ## WHAT TO SKIP IN THIS PROMPT
>
> ❌ Email invite system — too complex
> ❌ Permissions matrix — skip
> ❌ Collaborator cursors in TipTap textboard — skip
>
> ---
>
> ## FINAL RULES
> - Test avatars with 3 browser tabs simultaneously
> - Verify user leaves and avatar disappears within 3 seconds
> - QR code must render correctly and scan on mobile
> - Cursor presence: test at 200% zoom — cursors must appear at correct positions
> - Run `npm run dev` — zero console errors

---

---

# PROMPT 6 — Command Palette + Final Polish

> Add the command palette and apply final UI/UX polish. This is the last prompt — stability and consistency over new features.
>
> ---
>
> ## 1. COMMAND PALETTE (`Ctrl+K`)
>
> Global keyboard shortcut available on all pages:
>
> **Trigger:**
> - `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac)
> - Click on search bar in sidebar
>
> **Modal:**
> - Full screen backdrop: `rgba(0,0,0,0.6)`, click outside to close
> - Centered card: 560px wide, solid `#151524` (dark) / `#fff8f0` (light)
> - Border: `1px solid rgba(201,168,76,0.25)`
> - Border-radius: 12px
>
> **Inside:**
> - Search input at top (autofocused): `Search boards and whiteboards...`
> - Results list below: filters boards+whiteboards by title as user types
> - Each result: board type icon + title + last updated time
> - Highlight active result with gold background tint
> - Keyboard navigation: arrow keys move selection, Enter opens board, Escape closes
>
> **Empty state:** "No boards found for '[query]'"
>
> **Animation:**
> - Backdrop: fade in 150ms
> - Modal: scale from 0.96 + fade in 150ms
> - Close: reverse, 100ms
>
> ---
>
> ## 2. TOAST NOTIFICATIONS
>
> Install: `npm install react-hot-toast`
>
> Replace ALL browser `alert()` calls with toasts. Position: bottom-right.
>
> ```js
> // Success
> toast.success('Board created', { style: { background: '#151524', color: '#f5ecd7', border: '1px solid rgba(201,168,76,0.3)' } })
>
> // Error
> toast.error('Failed to save', { style: { background: '#151524', color: '#ED93B1' } })
> ```
>
> Show toasts for:
> ```
> ✓ Board created successfully
> ✓ Link copied to clipboard
> ✓ Saved
> ✓ Moved to trash
> ✓ Restored from trash
> ✓ Starred / Unstarred
> ✗ Failed to create board
> ✗ Failed to save
> ✗ Connection lost — reconnecting...
> ✓ Reconnected
> ```
>
> ---
>
> ## 3. LOADING STATES
>
> Replace any blank loading screens with skeleton loaders:
>
> **Dashboard board grid skeleton:**
> - 6 skeleton cards, same size as BoardCard
> - Shimmer animation: `background: linear-gradient(90deg, rgba(201,168,76,0.05) 25%, rgba(201,168,76,0.1) 50%, rgba(201,168,76,0.05) 75%)`
> - `background-size: 200% 100%`, `animation: shimmer 1.5s infinite`
>
> **Whiteboard loading:**
> - Centered spinner (gold) + "Loading board..." text
>
> **Textboard loading:**
> - Skeleton: 1 wide line (title) + 5 paragraph lines of varying width
>
> ---
>
> ## 4. EMPTY STATES
>
> ```
> All Boards empty:
>   Icon: Layout (48px, rgba(201,168,76,0.4))
>   Title: "No boards yet"
>   Subtitle: "Create your first board to get started"
>   Button: "+ New Board" (gold)
>
> Starred empty:
>   Icon: Star (48px, muted)
>   Title: "Nothing starred yet"
>   Subtitle: "Click the star on any board to find it here quickly"
>
> Trash empty:
>   Icon: Trash2 (48px, muted)
>   Title: "Trash is empty"
>   Subtitle: "Deleted boards will appear here for recovery"
>
> Whiteboard (new blank):
>   Center canvas: "Start your ideas ⚡"
>   Subtitle: "Use the toolbar to add shapes, text, images and more."
>   Fades out on first interaction
> ```
>
> ---
>
> ## 5. CANVAS GRID BACKGROUND (Whiteboard)
>
> Add background option button in whiteboard toolbar (Lucide: `Grid`):
> - **None**: solid background (current)
> - **Dots**: small dot grid (8px spacing)
> - **Lines**: grid lines (32px spacing)
>
> Grid color:
> ```
> Dark:  rgba(255,255,255,0.04)
> Light: rgba(0,0,0,0.05)
> ```
>
> Render grid on a background canvas layer (not the main drawing canvas).
> Store preference in localStorage per board.
>
> ---
>
> ## 6. TYPOGRAPHY CONSISTENCY
>
> Apply these consistently across ALL pages:
> ```
> Page titles:      Playfair Display, 24px, 600 weight
> Section titles:   Inter, 18px, 600 weight
> Card titles:      Inter, 15px, 500 weight
> Body text:        Inter, 14px, 400 weight, line-height 1.7
> Captions/muted:   Inter, 12px, 400 weight
> Code:             JetBrains Mono, 13px
> ```
>
> ---
>
> ## 7. CURSOR STYLES
>
> ```
> Default:              cursor: default
> Clickable:            cursor: pointer
> Draggable (idle):     cursor: grab
> Dragging:             cursor: grabbing
> Resize NW/SE:         cursor: nw-resize
> Resize NE/SW:         cursor: ne-resize
> Text tool:            cursor: text
> Pen tool:             cursor: crosshair
> Pan tool:             cursor: grab
> ```
>
> ---
>
> ## 8. FOCUS STATES (Accessibility)
>
> ```css
> :focus-visible {
>   outline: 2px solid #C9A84C;
>   outline-offset: 2px;
>   border-radius: 4px;
> }
> ```
>
> Apply to all buttons, inputs, and links.
>
> ---
>
> ## 9. SCROLLBAR STYLING
>
> ```css
> ::-webkit-scrollbar { width: 5px; height: 5px; }
> ::-webkit-scrollbar-track { background: transparent; }
> ::-webkit-scrollbar-thumb {
>   background: rgba(201,168,76,0.25);
>   border-radius: 3px;
> }
> ::-webkit-scrollbar-thumb:hover {
>   background: rgba(201,168,76,0.45);
> }
> ```
>
> ---
>
> ## 10. MOBILE BOTTOM NAV
>
> On mobile (<768px), add bottom navigation (56px height):
> ```
> 🏠 Home | 📋 Boards | 🎨 Draw | ⭐ Starred | ☰ More
> ```
> - Active tab: gold icon + label text
> - Inactive: muted icon, no label
> - Fixed at bottom with safe area inset for iPhone
> - Background: `#0d0d1a` (dark) / `#fdf6ee` (light)
> - Border-top: `1px solid rgba(201,168,76,0.15)`
>
> ---
>
> ## 11. KEYBOARD SHORTCUTS REFERENCE
>
> Add a `?` button to whiteboard toolbar that shows a shortcuts modal:
> ```
> V       Select tool
> H       Pan tool
> P       Pen tool
> E       Eraser
> T       Text
> S       Shapes
> N       Sticky note
> Ctrl+Z  Undo
> Ctrl+Y  Redo
> Ctrl+K  Command palette
> Ctrl+=  Zoom in
> Ctrl+-  Zoom out
> Ctrl+0  Reset zoom
> Escape  Cancel / deselect
> ```
>
> ---
>
> ## WHAT TO SKIP IN THIS PROMPT
>
> ❌ Route transitions — adds complexity for little gain
> ❌ React.lazy virtualization — premature optimization
> ❌ Export as Markdown — nice to have, not essential
>
> ---
>
> ## FINAL CHECKS (run all of these)
> - `npm run build` — zero errors, zero warnings
> - Test dark and light theme on every single page
> - Test at 375px mobile viewport — nothing overflows
> - Test Ctrl+K command palette — keyboard navigation works
> - Test all whiteboard tools still work after polish changes
> - Test two-tab real-time sync still works
> - Test admin login still works
> - Push to GitHub and verify Vercel deployment succeeds

---

---

# PACKAGES SUMMARY

```bash
# Prompt 4 (TipTap)
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
npm install @tiptap/extension-placeholder @tiptap/extension-typography
npm install @tiptap/extension-color @tiptap/extension-text-style
npm install @tiptap/extension-highlight
npm install @tiptap/extension-task-list @tiptap/extension-task-item
npm install @tiptap/extension-image @tiptap/extension-link

# Prompt 5 (QR Code)
npm install qrcode.react

# Prompt 6 (Toasts)
npm install react-hot-toast
```

---

# FEATURES INTENTIONALLY EXCLUDED

These were in the original plan but removed based on architectural feedback:

| Feature | Reason Excluded |
|---|---|
| Connector/Arrow tool | Too complex, jittery, recursive update risk |
| Rubber-band multi-select | Interaction conflicts with zoom/pan |
| Minimap dragging | High complexity, low value |
| TipTap collaboration (Yjs) | Way too complex for current scope |
| Collaborator cursors in TipTap | Skip — whiteboard cursors sufficient |
| Email invite system | Requires auth rewrite |
| Route transitions | Adds complexity for minimal gain |
| Random sticky note rotation | Causes coordinate sync bugs |

---


Then:
1. Vercel auto-redeploys frontend
2. Render auto-redeploys backend
3. Check Render env variables still have all required vars
4. Wake up Render: visit `https://blackboxblackboard.onrender.com`
5. Test full flow on live URL
6. Test on mobile device (not just browser resize)