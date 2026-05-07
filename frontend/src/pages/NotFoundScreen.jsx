// src/pages/NotFoundScreen.jsx
// Fallback 404 screen.
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundScreen({ darkMode, toggleTheme }) {
  const navigate = useNavigate();

  return (
    <div className="bb-bg min-h-screen flex items-center justify-center transition-colors duration-300 p-6 relative overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-[#AFA9EC]/10 blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[#ED93B1]/10 blur-[120px]" />
      </div>

      {/* Navbar Minimal */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass">
        <button onClick={() => navigate('/')} className="text-2xl font-extrabold text-[#C9A84C] tracking-tight">
          ⬛ BlackBoard
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#C9A84C]/30 text-sm font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
        >
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </nav>

      <div className="text-center relative z-10 max-w-lg">
        <h1 className="text-9xl font-extrabold text-[#C9A84C] mb-4 drop-shadow-xl animate-bounce">404</h1>
        <h2 className="text-3xl font-bold bb-text mb-4">Page not found</h2>
        <p className="bb-muted text-lg mb-8 leading-relaxed">
          Looks like you've wandered off the board. The link might be broken or the page may have been moved.
        </p>
        <button onClick={() => navigate('/')} className="btn-gold px-8 py-3 text-lg">
          Return Home
        </button>
      </div>
    </div>
  );
}
