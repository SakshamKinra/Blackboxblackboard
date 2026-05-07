// src/pages/BoardPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LockScreen from '../components/LockScreen';
import Editor     from '../components/Editor';

const API = process.env.REACT_APP_API_URL;

function Navbar({ darkMode, toggleTheme, navigate }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass bb-card">
      <button onClick={() => navigate('/')} className="text-2xl font-extrabold text-[#C9A84C] tracking-tight">
        ⬛ BlackBoard
      </button>
      <button
        id="theme-toggle"
        onClick={toggleTheme}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A84C]/30
                   text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
      >
        {darkMode ? '☀️ Light' : '🌙 Dark'}
      </button>
    </nav>
  );
}

export default function BoardPage({ darkMode, toggleTheme }) {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [board,    setBoard]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [content,  setContent]  = useState('');

  useEffect(() => {
    async function fetchBoard() {
      try {
        const { data } = await axios.get(`${API}/api/boards/${id}`);
        if (data.success) setBoard(data);
        else setError('Board not found.');
      } catch (err) {
        setError(err.response?.status === 404 ? 'Board not found.' : 'Failed to load board.');
      } finally {
        setLoading(false);
      }
    }
    fetchBoard();
  }, [id]);

  function handleUnlocked(unlockedContent) {
    setContent(unlockedContent);
    setUnlocked(true);
  }

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} navigate={navigate} />;

  return (
    <div className="bb-bg flex flex-col min-h-screen transition-colors duration-300">
      <Navbar darkMode={darkMode} toggleTheme={toggleTheme} navigate={navigate} />

      <main className="flex-1 flex flex-col pt-16">
        {unlocked ? (
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b border-[#C9A84C]/10 bb-card flex items-center gap-3">
              <span className="text-[#C9A84C] font-semibold text-sm">Board</span>
              <span className="bb-muted text-sm font-mono">{id}</span>
            </div>
            <div className="flex-1">
              <Editor boardId={id} initialContent={content} />
            </div>
          </div>
        ) : (
          <LockScreen board={board} onUnlock={handleUnlocked} />
        )}
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bb-bg flex flex-col items-center justify-center bb-muted gap-4">
      <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">Loading board…</p>
    </div>
  );
}

function ErrorScreen({ message, navigate }) {
  return (
    <div className="min-h-screen bb-bg bb-text flex flex-col items-center justify-center px-6 gap-6 text-center">
      <div className="text-6xl">🚫</div>
      <h1 className="text-2xl font-bold text-[#ED93B1]">{message}</h1>
      <p className="bb-muted">The board may have been deleted or the link is invalid.</p>
      <button onClick={() => navigate('/')} className="btn-gold">← Back Home</button>
    </div>
  );
}
