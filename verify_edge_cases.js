const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:5000/api';
const MONGODB_URI = 'mongodb+srv://sakshamkinra_db_user:sD4cHAnmgWFUaOcu@blackbox.w5pwijm.mongodb.net/blackboard?retryWrites=true&w=majority&appName=blackbox';

async function runTests() {
  console.log('--- Starting Edge Case Verification ---');
  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  };

  try {
    // 1. Invalid Links
    try {
      await axios.get(`${API_BASE}/boards/this-id-does-not-exist`);
      assert(false, 'Invalid link should return 404');
    } catch (err) {
      assert(err.response?.status === 404, 'Invalid link returns 404');
    }

    // 2. Wrong Password
    let boardId;
    try {
      const res = await axios.post(`${API_BASE}/boards`, {
        unlockType: 'password',
        password: 'correct_password',
        expiresAfter: 3
      });
      boardId = res.data.boardId;
      assert(!!boardId, 'Board with password created');
    } catch (err) {
      assert(false, 'Failed to create password board');
    }

    if (boardId) {
      try {
        await axios.post(`${API_BASE}/boards/${boardId}/unlock`, { password: 'wrong_password' });
        assert(false, 'Wrong password should return 401');
      } catch (err) {
        assert(err.response?.status === 401, 'Wrong password returns 401');
      }

      // Correct password
      try {
        const res = await axios.post(`${API_BASE}/boards/${boardId}/unlock`, { password: 'correct_password' });
        assert(res.status === 200, 'Correct password returns 200');
        assert(!!res.data.boardToken, 'JWT token returned on successful unlock');
      } catch (err) {
        assert(false, 'Correct password failed');
      }
    }

    // 3. Expired Board
    try {
      await mongoose.connect(MONGODB_URI);
      const Board = require('./backend/models/Board'); // need path
      
      const res = await axios.post(`${API_BASE}/boards`, {
        unlockType: 'password',
        password: 'test',
        expiresAfter: 1
      });
      const expBoardId = res.data.boardId;
      
      // manually expire it in DB
      await Board.updateOne({ boardId: expBoardId }, { 
        activatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        expiresAfter: 1 
      });

      try {
        await axios.get(`${API_BASE}/boards/${expBoardId}`);
        assert(false, 'Expired board GET should return 410 or update isExpired');
      } catch (err) {
        // GET returns 200 but isExpired: true
      }
      
      const statusRes = await axios.get(`${API_BASE}/boards/${expBoardId}`);
      assert(statusRes.data.isExpired === true, 'Expired board status returns isExpired: true');

      try {
        await axios.post(`${API_BASE}/boards/${expBoardId}/unlock`, { password: 'test' });
        assert(false, 'Expired board UNLOCK should return 410');
      } catch (err) {
        assert(err.response?.status === 410, 'Expired board UNLOCK returns 410');
      }
      
      await mongoose.disconnect();
    } catch (err) {
      console.error(err);
      assert(false, 'Expired board test threw an error');
    }

    // 4. Large Inputs
    try {
      const hugeContent = 'A'.repeat(5 * 1024 * 1024); // 5MB string
      const res = await axios.post(`${API_BASE}/boards`, {
        unlockType: 'password',
        password: 'test',
        content: hugeContent
      });
      // depending on body-parser limit, it might pass or fail (usually default is 100kb/1mb)
      // let's just see what happens. If it fails with 413 Payload Too Large, that's good.
      // If it passes, we ensure it's handled. Express default json limit is 100kb.
      assert(res.status === 201, 'Created board with 5MB content');
    } catch (err) {
      assert(err.response?.status === 413, 'Large payload correctly rejected with 413 Payload Too Large');
    }

  } catch (err) {
    console.error('Unhandled error:', err.message);
  } finally {
    console.log(`\nTests completed: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
