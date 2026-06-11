# BlackBoard
> A real-time collaborative whiteboard built with React, Node.js, Socket.io, and MongoDB.

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)

![Demo](./assets/demo.gif)

## 📸 Screenshots
*<img width="1887" height="626" alt="Screenshot 2026-05-15 054144" src="https://github.com/user-attachments/assets/9a2e25af-015e-46a4-bd07-4d042dd7ae12" />


## ✨ Features
- **Multi-User Collaboration**: Work together with teammates on the same board simultaneously.
- **Real-Time Sync**: Instantaneous updates across all connected clients via WebSockets.
- **Sticky Notes**: Add, edit, and move sticky notes around the canvas.
- **Text Editing**: Rich text support right on the board.
- **Undo/Redo**: Fully functional state history for robust error recovery.
- **User Attribution**: See who is currently typing or editing an element.


## 🛠 Tech Stack
- **Frontend**: React, Canvas API, CSS3
- **Backend**: Node.js, Express.js
- **Real-time Engine**: Socket.io
- **Database**: MongoDB

## 🏗 Architecture
Our architecture ensures low latency and reliable state synchronization.

```text
+---------+          +----------------+          +-------------------+
|  Users  |  <====>  | React Frontend |  <====>  |     Socket.io     |
+---------+          +----------------+          +-------------------+
                                                           |
                                                           v
                                                 +-------------------+
                                                 | Node.js / Express |
                                                 +-------------------+
                                                           |
                                                           v
                                                 +-------------------+
                                                 |      MongoDB      |
                                                 +-------------------+
```

## 🧠 Challenges Solved

### Real-Time Synchronization
To ensure all clients see the exact same state without race conditions, we implemented an optimized event-driven architecture with Socket.io. State patches are broadcasted efficiently to minimize bandwidth and resolve conflicts gracefully.

### Hybrid Rendering (Canvas + DOM)
Combining the raw drawing performance of the HTML5 Canvas with the accessibility and rich text capabilities of the DOM (for sticky notes and text editing). This hybrid approach provides the best of both worlds: buttery smooth freehand drawing and native text inputs.

### State Persistence
All collaborative sessions are continuously saved to MongoDB. This guarantees that no data is lost upon disconnection and enables users to return to their boards exactly as they left them.

## 🏁 Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- MongoDB (local or Atlas)

### Installation & Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/BlackBoard.git
   cd BlackBoard
   ```

2. **Setup the Backend**
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend/` directory (see Environment Variables below).
   ```bash
   npm start # or npm run dev
   ```

3. **Setup the Frontend**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

## 🔐 Environment Variables (.env.example)
Create a `.env` file in your `backend/` directory based on this example:

```env
# Backend server port
PORT=5000

# MongoDB Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/blackboard?retryWrites=true&w=majority

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# JWT Secret (if applicable for auth)
JWT_SECRET=your_super_secret_string
```
