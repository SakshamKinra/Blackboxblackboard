// src/pages/BoardPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import LockScreen from '../components/LockScreen';
import Editor     from '../components/Editor';
import Whiteboard from '../components/Whiteboard';

const SOCKET_URL = process.env.REACT_APP_API_URL;
const API = process.env.REACT_APP_API_URL;

function Navbar({ darkMode, toggleTheme, navigate }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass" style={{ backgroundColor: 'var(--nav-bg)' }}>
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

// ── Expiry countdown banner ─────────────────────────────────
function ExpiryBanner({ activatedAt, expiresAfter }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    function calc() {
      if (!activatedAt || !expiresAfter) return null;
      const expiryMs = new Date(activatedAt).getTime() + expiresAfter * 60 * 60 * 1000;
      const diff = expiryMs - Date.now();
      if (diff <= 0) return null;
      return {
        hours:   Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
      };
    }

    setTimeLeft(calc());
    const timer = setInterval(() => {
      const t = calc();
      setTimeLeft(t);
    }, 30000); // update every 30s

    return () => clearInterval(timer);
  }, [activatedAt, expiresAfter]);

  if (!timeLeft) return null;

  return (
    <div className="px-4 py-2 text-center text-sm font-semibold border-b"
         style={{ backgroundColor: 'var(--expiry-bg)', color: 'var(--expiry-text)', borderColor: 'var(--expiry-border)' }}>
      {timeLeft.hours}h {timeLeft.minutes}m until expiration
    </div>
  );
}

// ── Expired full-screen ──────────────────────────────────────
function ExpiredScreen({ navigate }) {
  return (
    <div className="min-h-screen bb-bg flex flex-col items-center justify-center px-6 gap-6 text-center">
      <div className="text-7xl animate-fade-in select-none">🔒</div>
      <h1 className="text-3xl font-extrabold text-[#ED93B1] animate-slide-up">
        This Board Has Expired
      </h1>
      <p className="bb-muted max-w-sm animate-slide-up">
        The link for this board is no longer valid. The board expired after its activation window.
      </p>
      <button onClick={() => navigate('/')} className="btn-gold animate-slide-up">
        ← Back Home
      </button>
    </div>
  );
}

export default function BoardPage({ darkMode, toggleTheme }) {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [board,        setBoard]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [unlocked,     setUnlocked]     = useState(false);
  const [content,      setContent]      = useState('');
  const [boardName,    setBoardName]    = useState('');
  const [isExpired,    setIsExpired]    = useState(false);
  const [activatedAt,  setActivatedAt]  = useState(null);
  const [expiresAfter, setExpiresAfter] = useState(3);
  const [displayName, setDisplayName] = useState('');
  const [boardToken,   setBoardToken]   = useState(null);
  
  const [activeTab,    setActiveTab]    = useState('text');
  const [socket,       setSocket]       = useState(null);
  const [connected,    setConnected]    = useState(false);
  const [userCount,    setUserCount]    = useState(1);

  useEffect(() => {
    async function fetchBoard() {
      try {
        const { data } = await axios.get(`${API}/api/boards/${id}`);
        if (data.success) {
          setBoard(data);
          // Check if board is already expired on load
          if (data.isExpired) {
            setIsExpired(true);
          }
          if (data.activatedAt) setActivatedAt(data.activatedAt);
          if (data.expiresAfter) setExpiresAfter(data.expiresAfter);
        } else {
          setError('We couldn\'t find this board. The link may be invalid.');
        }
      } catch (err) {
        setError(err.response?.status === 404 ? 'We couldn\'t find this board. The link may be invalid.' : 'Something went wrong. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchBoard();
  }, [id]);

  function handleUnlocked(unlockedContent, unlockedBoardName, unlockedActivatedAt, unlockedExpiresAfter, unlockedDisplayName, unlockedBoardToken) {
    setContent(unlockedContent);
    setBoardName(unlockedBoardName || '');
    if (unlockedActivatedAt) setActivatedAt(unlockedActivatedAt);
    if (unlockedExpiresAfter) setExpiresAfter(unlockedExpiresAfter);
    if (unlockedDisplayName) {
      setDisplayName(unlockedDisplayName);
      sessionStorage.setItem(`bb-name:${id}`, unlockedDisplayName);
    }
    if (unlockedBoardToken) {
      setBoardToken(unlockedBoardToken);
    }
    setUnlocked(true);
  }

  useEffect(() => {
    if (!unlocked || !boardToken) return;
    
    const newSocket = io(SOCKET_URL, { 
      transports: ['websocket'],
      auth: { token: boardToken }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      const savedName = displayName || sessionStorage.getItem(`bb-name:${id}`) || '';
      if (!savedName.trim()) return;
      newSocket.emit('join_board', { boardId: id, userName: savedName });
    });

    newSocket.on('user_joined', () => setUserCount(c => c + 1));
    newSocket.on('user_left',   () => setUserCount(c => Math.max(1, c - 1)));

    newSocket.on('disconnect', () => setConnected(false));

    return () => newSocket.disconnect();
  }, [unlocked, id, displayName]);

  if (loading)   return <LoadingScreen />;
  if (isExpired) return <ExpiredScreen navigate={navigate} />;
  if (error)     return <ErrorScreen message={error} navigate={navigate} />;

  return (
    <div className="bb-bg flex flex-col min-h-screen transition-colors duration-300">
      <Navbar darkMode={darkMode} toggleTheme={toggleTheme} navigate={navigate} />

      <main className="flex-1 flex flex-col pt-16">
        {unlocked ? (
          <div className="flex-1 flex flex-col">
            {/* Expiry countdown banner */}
            {activatedAt && (
              <ExpiryBanner activatedAt={activatedAt} expiresAfter={expiresAfter} />
            )}

            <div className="px-6 py-3 border-b border-[#C9A84C]/10 bb-card flex items-center justify-between overflow-x-auto">
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[#C9A84C] font-semibold text-sm">Board</span>
                {boardName && boardName !== 'Untitled Board' && (
                  <span className="font-playfair bb-text text-lg font-semibold">{boardName}</span>
                )}
                <span className="bb-muted text-sm font-mono">{id}</span>
              </div>
              <div className="flex bg-[var(--card)] border border-[var(--input-border)] rounded-lg shrink-0 ml-4">
                <button 
                  onClick={() => setActiveTab('text')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'text' ? 'text-[var(--text)] border-b-2 border-[#C9A84C]' : 'text-[var(--muted)] hover:text-[#C9A84C]'}`}
                >
                  📝 Text
                </button>
                <button 
                  onClick={() => setActiveTab('whiteboard')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'whiteboard' ? 'text-[var(--text)] border-b-2 border-[#C9A84C]' : 'text-[var(--muted)] hover:text-[#C9A84C]'}`}
                >
                  🎨 Whiteboard
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${activeTab === 'text' ? 'z-10 opacity-100 pointer-events-auto' : 'z-0 opacity-0 pointer-events-none'}`}>
                <Editor boardId={id} initialContent={content} socket={socket} connected={connected} userCount={userCount} displayName={displayName} />
              </div>
              <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${activeTab === 'whiteboard' ? 'z-10 opacity-100 pointer-events-auto' : 'z-0 opacity-0 pointer-events-none'}`}>
                <Whiteboard boardId={id} socket={socket} connected={connected} userCount={userCount} displayName={displayName} />
              </div>
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
    <div className="min-h-screen bb-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        {/* Simulating 3 card-shaped blocks */}
        <div className="w-full h-32 rounded-xl animate-shimmer" />
        <div className="w-full h-24 rounded-xl animate-shimmer" />
        <div className="w-full h-16 rounded-xl animate-shimmer" />
        <div className="flex justify-center pt-4">
          <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
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
