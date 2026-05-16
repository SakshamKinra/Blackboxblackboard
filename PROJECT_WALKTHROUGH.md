# BlackBoard Project Walkthrough

Welcome to the **BlackBoard** codebase walkthrough. BlackBoard (also referred to as BlackBox) is a premium, real-time collaborative workspace platform. It features rich digital whiteboards, text-based notes, and standalone whiteboard instances seamlessly synced via WebSockets.

This document breaks down the architecture, the technology stack, core features, and the internal component structure of the application.

---

## 🛠 Technology Stack

The project operates on a classic **MERN + WebSockets** architecture:

*   **Frontend:** React 18, React Router DOM, TailwindCSS (for styling), Axios (for API requests), Lucide React (for iconography), and `socket.io-client`.
*   **Backend:** Node.js, Express.js, MongoDB (with Mongoose), Socket.io (for real-time events), JSON Web Tokens (JWT) for authentication, and Multer for file uploads.
*   **Security Tools:** `express-rate-limit`, `helmet`, `cors`, `bcryptjs`, and `dompurify` (frontend XSS prevention).

---

## ✨ Core Features

1.  **User Authentication:** Secure signup/login using hashed passwords and JWTs.
2.  **Dashboards & Projects (Locked Boards):** Users can create authenticated projects containing a rich Markdown editor (Notes) side-by-side with a fully collaborative whiteboard.
3.  **Standalone Whiteboards:** Fast, ephemeral collaborative whiteboards that can be generated and joined without creating an account.
4.  **Real-Time Sync Engine:**
    *   Ephemeral coordinate broadcasting (`draw_sync`) for smooth cursor and live stroke rendering.
    *   Persistent database commitments (`draw_stroke`) upon completing a stroke.
    *   Instantaneous Undo/Redo mechanisms synchronized across all clients.
5.  **Advanced Whiteboard Objects:**
    *   **Paths:** Vector-style contiguous drawing strokes preventing high-load segment generation.
    *   **Text Overlays:** `contentEditable` DOM elements that overlay the canvas, supporting moving and live editing.
    *   **Image Overlays:** Images can be uploaded, freely moved, and dynamically resized maintaining aspect ratio.

---

## 🏗 Architecture Breakdown

The repository is split into two primary domains: `frontend/` and `backend/`.

### 1. Backend (`/backend`)
The Node/Express server serves as both the REST API provider and the WebSocket hub.

*   **`server.js`:** The heart of the application. It bootstraps the Express app, connects to MongoDB, mounts routes, and crucially, handles all `Socket.io` event listeners for real-time board manipulation.
*   **Models (`/models`):**
    *   `User.js`: Standard user credentials.
    *   `Board.js`: The authenticated project dashboards (containing notes and whiteboard arrays).
    *   `Whiteboard.js`: The standalone whiteboard schema, storing `strokes`, `images`, and configurations.
    *   `Note.js`: Standalone rich-text notes.
*   **Routes & Controllers (`/routes`, `/controllers`):** Standard CRUD operations decoupled from the socket logic (e.g., `authController.js`, `boardController.js`).

### 2. Frontend (`/frontend`)
The React SPA is heavily component-driven, prioritizing a dynamic and premium "glassmorphism" UX.

*   **`src/App.js`:** The root router handling authentication boundaries and layout wrappers.
*   **Pages (`/src/pages`):**
    *   `Dashboard.jsx`: The authenticated user's home screen listing their projects.
    *   `BoardPage.jsx`: The split-view workspace containing a Note and the `Whiteboard.jsx` component.
    *   `WhiteboardPage.jsx`: The standalone, unauthenticated whiteboard environment.
*   **Components (`/src/components`):**
    *   `Whiteboard.jsx`: The core interactive canvas engine used in authenticated projects.
    *   `ImageObject.jsx` & `TextObject.jsx`: The modern DOM-overlay architecture allowing images and text to be interacted with via contextual menus (Move, Resize, Delete) independently of the standard canvas `drawImage`/`fillText` pipeline.
    *   `Note.jsx`: The markdown-based text editor.

---

## 🔒 Security Posture

A recent comprehensive security audit hardened the application:
1.  **Rate Limiting:** IP-based request throttling on high-load routes like `/api/whiteboards` to prevent DDoS or DB spamming.
2.  **Socket Authentication:** WebSockets explicitly require valid JWTs during the handshake phase to prevent ghost-connections.
3.  **Data Sanitization:** Input limits enforced server-side. On the frontend, `DOMPurify` is aggressively utilized within `TextObject.jsx` to prevent Cross-Site Scripting (XSS) via injected HTML text strokes.

---

## 🚀 Recent Refactoring (Whiteboard Stabilization)

The whiteboard engine recently underwent a massive architectural shift:
1.  **Segment to Object Conversion:** To solve MongoDB array truncation limits (`>3000 elements`), the drawing engine was upgraded from a frame-by-frame segment model (`{startX, startY, endX, endY}`) to an intelligent continuous path model (`{points: [{x,y}]}`).
2.  **DOM Overlay Architecture:** Text and Images were moved out of the rigid HTML5 `<canvas>` rendering cycle. They now act as floating React components over the canvas. This allows for rich hover-states, intuitive corner-dragging for resizes, and floating context menus—bringing the UX up to industry standards without rewriting the backend database schemas.

---

*This document serves as the top-level architectural map for the BlackBoard application. To dive deeper, check the frontend and backend `README.md` files or explore the `server.js` and `WhiteboardPage.jsx` entry points.*
