# Deployment Guide

This guide explains how to deploy BlackBoard for free using popular platform-as-a-service (PaaS) providers.

## 1. Database: MongoDB Atlas (Free Tier)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account.
2. Build a new cluster (select the FREE Shared tier).
3. Under **Database Access**, create a new database user with a secure password.
4. Under **Network Access**, add `0.0.0.0/0` to allow access from anywhere (required for serverless/PaaS deployments).
5. Click **Connect** -> **Connect your application** and copy the Connection String.
   - *Remember to replace `<password>` with your actual database user password.*

## 2. Backend + Socket.io: Render (or Railway)
Since Vercel uses serverless functions that don't support long-lived WebSocket connections, the backend must be deployed to a service like Render or Railway.

### Deploying on Render (Free Web Service)
1. Push your code to GitHub.
2. Create a [Render](https://render.com/) account and click **New+** -> **Web Service**.
3. Connect your GitHub repository.
4. **Settings:**
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start` (or `node server.js`)
5. **Environment Variables:**
   - `PORT`: `10000` (Render defaults to this)
   - `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   - `FRONTEND_URL`: `<Your Vercel deployment URL (add this after deploying frontend)>`
6. Deploy! Copy the Render URL (e.g., `https://blackboard-api.onrender.com`).

## 3. Frontend: Vercel (or Netlify)
1. Go to [Vercel](https://vercel.com/) and connect your GitHub account.
2. Click **Add New** -> **Project** and import your BlackBoard repository.
3. **Settings:**
   - Framework Preset: `Vite` (or `Create React App`, depending on your setup)
   - Root Directory: `frontend`
4. **Environment Variables:**
   - `VITE_API_URL` (or `REACT_APP_API_URL`): `<Your Render backend URL>`
5. Deploy! Vercel will give you a live frontend URL (e.g., `https://blackboard.vercel.app`).

---
**Important Final Step:** Go back to your Backend on Render and update the `FRONTEND_URL` environment variable to match your new Vercel URL to ensure CORS allows the connection!
