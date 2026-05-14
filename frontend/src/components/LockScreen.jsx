// src/components/LockScreen.jsx
import React, { useState } from 'react';
import axios from 'axios';
import Countdown from './Countdown';

const API = process.env.REACT_APP_API_URL;

export default function LockScreen({ board, onUnlock }) {
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const needsPassword = board.unlockType === 'password' || board.unlockType === 'both';
  const needsDate     = board.unlockType === 'date'     || board.unlockType === 'both';

  async function handleUnlock() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('Display name is required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/boards/${board.boardId}/unlock`, {
        password: needsPassword ? password : undefined,
      });
      if (data.success && !data.locked) {
        onUnlock(data.content, data.boardName, data.activatedAt, data.expiresAfter, trimmedName);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unlock failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bb-bg flex flex-col items-center justify-center min-h-screen px-4 transition-colors duration-300">

      <div className="text-7xl mb-6 animate-fade-in select-none">🔒</div>

      {board.boardName && board.boardName !== 'Untitled Board' && (
        <h2 className="text-xl font-bold text-[#C9A84C] mb-2 text-center animate-fade-in">
          {board.boardName}
        </h2>
      )}

      <h1 className="text-3xl font-extrabold gradient-text mb-2 text-center animate-slide-up">
        This Board is Locked
      </h1>
      <p className="bb-muted mb-8 text-center max-w-sm animate-slide-up">
        {needsDate && needsPassword
          ? 'This board requires both the countdown to expire and the correct password.'
          : needsDate
          ? 'This board unlocks automatically after the countdown below.'
          : 'Enter the correct password to unlock this board.'}
      </p>

      {needsDate && board.unlockAt && (
        <div className="mb-8 animate-fade-in">
          <Countdown unlockAt={board.unlockAt} serverTime={board.serverTime} />
        </div>
      )}

      {needsPassword && (
        <div className="w-full max-w-sm mb-4 animate-slide-up">
          <label className="block text-sm font-semibold text-[#C9A84C] mb-1 uppercase tracking-wider">
            Password
          </label>
          <input
            id="unlock-password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="Enter board password…"
            className="bb-input"
          />
        </div>
      )}

      <div className="w-full max-w-sm mb-4 animate-slide-up">
        <label className="block text-sm font-semibold text-[#C9A84C] mb-1 uppercase tracking-wider">
          Your Name
        </label>
        <input
          id="display-name"
          type="text"
          value={displayName}
          onChange={e => { setDisplayName(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          placeholder="Required to join collaboration"
          className="bb-input"
          maxLength={30}
        />
      </div>

      {error && (
        <p className="text-[#ED93B1] text-sm mb-4 flex items-center gap-2 animate-fade-in">
          <span>⚠️</span> {error}
        </p>
      )}

      <button
        id="unlock-btn"
        onClick={handleUnlock}
        disabled={loading}
        className="btn-gold min-w-[180px] flex items-center justify-center gap-2 animate-slide-up"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-[#0d0d1a] border-t-transparent rounded-full animate-spin" />
            Checking…
          </>
        ) : '🔓 Unlock Board'}
      </button>
    </div>
  );
}
